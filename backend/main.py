import os
import modal

app = modal.App("logitlensviz")

model_volume = modal.Volume.from_name("model-weights-vol", create_if_missing=True)
hf_secret = modal.Secret.from_name("huggingface-secret")

VOLUME_MOUNT = "/model-cache"

tl_image = (
    modal.Image.debian_slim(python_version="3.12")
    .pip_install(
        "torch==2.6.0",
        "transformer-lens==2.18.0",
        "einops==0.8.1",
        "fancy-einsum==0.0.3",
        "jaxtyping==0.3.2",
    )
    .env({
        "HF_HOME": f"{VOLUME_MOUNT}/hf_home",
        "TRANSFORMERS_CACHE": f"{VOLUME_MOUNT}/hf_home",
    })
)

hf_image = (
    modal.Image.debian_slim(python_version="3.12")
    .pip_install(
        "torch==2.6.0",
        "transformers>=4.57",
        "accelerate==1.10.1",
        "safetensors==0.5.3",
    )
    .env({
        "HF_HOME": f"{VOLUME_MOUNT}/hf_home",
        "TRANSFORMERS_CACHE": f"{VOLUME_MOUNT}/hf_home",
    })
)


MODEL_REGISTRY: dict[str, dict] = {
    "gpt2-small": {
        "display_name": "GPT-2 Small",
        "tl_id": "gpt2-small",
        "hf_id": "openai-community/gpt2",
        "requires_hf_token": False,
        "path": "tl",
    },
    "meta-llama/Meta-Llama-3-8B": {
        "display_name": "Llama 3 (8B)",
        "tl_id": "meta-llama/Meta-Llama-3-8B",
        "hf_id": "meta-llama/Meta-Llama-3-8B",
        "requires_hf_token": True,
        "path": "tl",
    },
    "Qwen/Qwen2.5-7B": {
        "display_name": "Qwen 2.5 (7B)",
        "tl_id": "Qwen/Qwen2.5-7B",
        "hf_id": "Qwen/Qwen2.5-7B",
        "requires_hf_token": False,
        "path": "tl",
    },
}

web_image = modal.Image.debian_slim(python_version="3.12").pip_install(
    "fastapi[standard]", "pydantic"
)


@app.cls(
    image=tl_image,
    gpu="A10G",
    secrets=[hf_secret],
    volumes={VOLUME_MOUNT: model_volume},
    timeout=600,
    scaledown_window=60,
)
class TransformerLensInference:
    model_id: str = modal.parameter()

    @modal.enter()
    def load_model(self):
        import torch
        from transformer_lens import HookedTransformer

        torch.set_grad_enabled(False)
        
        # This might need changes depending on the model loaded
        self.model = HookedTransformer.from_pretrained_no_processing(
            self.model_id,
            center_unembed=False,
            center_writing_weights=True,
            fold_ln=True,
            refactor_factored_attn_matrices=False,
            dtype=torch.bfloat16,
        )
        self.model.eval()

    @modal.method()
    def run_logit_lens(self, prompt: str) -> dict:
        import torch

        tokens = self.model.to_tokens(prompt)
        _, cache = self.model.run_with_cache(tokens)

        accumulated_residual, labels = cache.accumulated_resid(
            layer=-1, incl_mid=False, return_labels=True
        )
        resid_at_layers = accumulated_residual[:, 0, :, :]
        scaled_resid = self.model.ln_final(resid_at_layers)
        layer_logits = self.model.unembed(scaled_resid)
        layer_probs = layer_logits.softmax(dim=-1)

        next_tokens = tokens[0, 1:]
        layer_probs_for_next = layer_probs[:, :-1, :]
        n_layers, seq_len_minus_1, _ = layer_probs_for_next.shape
        gathered_probs = torch.gather(
            layer_probs_for_next,
            dim=-1,
            index=next_tokens.view(1, seq_len_minus_1, 1).expand(n_layers, -1, 1),
        ).squeeze(-1)

        token_strings = self.model.to_str_tokens(tokens)[1:]

        return {
            "x_labels": token_strings,
            "y_labels": labels,
            "heatmap_data": gathered_probs.float().cpu().tolist(),
        }


@app.cls(
    image=hf_image,
    gpu="A10G",
    secrets=[hf_secret],
    volumes={VOLUME_MOUNT: model_volume},
    timeout=600,
    scaledown_window=60,
)
class HFInference:
    model_id: str = modal.parameter()

    @modal.enter()
    def load_model(self):
        import torch
        from transformers import AutoTokenizer, AutoModelForCausalLM

        torch.set_grad_enabled(False)
        hf_token = os.environ.get("HF_TOKEN")

        self.tokenizer = AutoTokenizer.from_pretrained(self.model_id, token=hf_token)
        self.model = AutoModelForCausalLM.from_pretrained(
            self.model_id,
            torch_dtype=torch.bfloat16,
            device_map="auto",
            token=hf_token,
        )
        self.model.eval()

    @modal.method()
    def run_logit_lens(self, prompt: str) -> dict:
        import torch

        inputs = self.tokenizer(prompt, return_tensors="pt").to(self.model.device)
        input_ids = inputs["input_ids"]

        with torch.no_grad():
            outputs = self.model(**inputs, output_hidden_states=True)

        # hidden_states: tuple of (n_layers+1) tensors [batch, seq, d_model]
        # index 0 = token embedding; indices 1..n = post-block residual streams
        hidden_states = outputs.hidden_states
        stacked = torch.stack(hidden_states, dim=0)[:, 0, :, :]  # [n_layers+1, seq, d_model]

        final_ln = self._get_final_ln()
        normed = final_ln(stacked)
        logits = self.model.lm_head(normed)
        probs = logits.softmax(dim=-1)

        next_tokens = input_ids[0, 1:]
        probs_for_next = probs[:, :-1, :]
        n_states, seq_m1, _ = probs_for_next.shape
        gathered = torch.gather(
            probs_for_next,
            dim=-1,
            index=next_tokens.view(1, seq_m1, 1).expand(n_states, -1, 1),
        ).squeeze(-1)

        n_real_layers = len(hidden_states) - 1
        labels = ["embedding"] + [f"blocks.{i}.hook_resid_post" for i in range(n_real_layers)]

        token_strings = self.tokenizer.convert_ids_to_tokens(input_ids[0, 1:].tolist())
        token_strings = [t.replace("Ġ", " ").replace("Ċ", "\n") for t in token_strings]

        return {
            "x_labels": token_strings,
            "y_labels": labels,
            "heatmap_data": gathered.float().cpu().tolist(),
        }

    def _get_final_ln(self):
        # Standard for Llama, Qwen2, Mistral, Gemma: model.model.norm
        inner = getattr(self.model, "model", None)
        if inner is not None:
            norm = getattr(inner, "norm", None)
            if norm is not None:
                return norm
        # GPT-NeoX style
        gpt_neox = getattr(self.model, "gpt_neox", None)
        if gpt_neox is not None:
            return gpt_neox.final_layer_norm
        # OPT style
        decoder = getattr(getattr(self.model, "model", None), "decoder", None)
        if decoder is not None:
            ln = getattr(decoder, "final_layer_norm", None)
            if ln is not None:
                return ln
        raise RuntimeError(
            f"Cannot locate final LayerNorm for {self.model_id}. "
            "Add a case to _get_final_ln()."
        )


@app.function(image=web_image)
@modal.concurrent(max_inputs=50)
@modal.asgi_app()
def api():
    from fastapi import FastAPI, HTTPException
    from fastapi.middleware.cors import CORSMiddleware
    from pydantic import BaseModel

    web_app = FastAPI()
    web_app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:3000"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    class LogitLensRequest(BaseModel):
        prompt: str
        model_name: str
        top_k: int = 5

    @web_app.get("/api/models")
    def list_models():
        return [
            {
                "id": key,
                "display_name": entry["display_name"],
                "requires_hf_token": entry["requires_hf_token"],
            }
            for key, entry in MODEL_REGISTRY.items()
        ]

    @web_app.post("/api/run-lens")
    async def run_logit_lens(request: LogitLensRequest):
        entry = MODEL_REGISTRY.get(request.model_name)
        if entry is None:
            raise HTTPException(
                status_code=400,
                detail=f"Unknown model '{request.model_name}'. Available: {list(MODEL_REGISTRY.keys())}",
            )
        try:
            if entry["path"] == "tl":
                result = await TransformerLensInference(
                    model_id=entry["tl_id"]
                ).run_logit_lens.remote.aio(request.prompt)
            else:
                result = await HFInference(
                    model_id=entry["hf_id"]
                ).run_logit_lens.remote.aio(request.prompt)
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
        return result

    return web_app
