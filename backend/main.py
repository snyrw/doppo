from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import torch
from transformer_lens import HookedTransformer, ActivationCache
import transformer_lens.utils as utils

app = FastAPI()

# 1. CORS setup: This allows your Next.js app (port 3000) to talk to Python (port 8000)
app.add_middleware(
    # CORS or "Cross-Origin Resource Sharing" refers to the situations when a frontend running in 
    # a browser has JavaScript code that communicates with a backend, and the backend is in a 
    # different "origin" than the frontend.

    CORSMiddleware,
    allow_origins=["http://localhost:3000"], # Out frontend is allowed to make cross-origin requests
    allow_credentials=True, # Cookies allowed for cross-origin requests
    allow_methods=["*"], # Allows all standard HTTP methods
    allow_headers=["*"], # Request headers allowed for cross-origin support
)

# 2. Define what Next.js will send to Python
class LogitLensRequest(BaseModel):
    prompt: str
    model_name: str
    top_k: int = 5

# Optional: Load your model globally so it doesn't reload on every single click
# print("Loading model...")
# model = HookedTransformer.from_pretrained("gpt2-small")
# print("Model loaded!")

# Successfully runs GPT2!
@app.post("/api/run-lens")
def run_logit_lens(request: LogitLensRequest):
    try:
        # Todo: Paste notebook logic here
        # 1. Tokenize request.prompt
        # 2. Run model with hooks / get cache
        # 3. Calculate logit lens

        torch.set_grad_enabled(False)
        print("Disabled automatic differentiation")

        model = HookedTransformer.from_pretrained_no_processing(
            "gpt2-small",
            center_unembed=False,
            center_writing_weights=True,
            fold_ln=True,
            refactor_factored_attn_matrices=False,
            dtype=torch.bfloat16
        )

        device: torch.device = utils.get_device()

        prompt = "The capital of France is Paris. The capital of Germany is"
        tokens = model.to_tokens(prompt)
        logits, cache = model.run_with_cache(tokens)

        # 2. Extract accumulated residual stream across all layers
        # Shape: [n_layers, batch, seq_len, d_model]
        accumulated_residual, labels = cache.accumulated_resid(
            layer=-1, incl_mid=False, return_labels=True # why not include mid?
        )

        # 3. Apply final LayerNorm and unembedding to get logits at each layer
        # We apply it to the first batch element
        resid_at_layers = accumulated_residual[:, 0, :, :] # we set batch to 0?
        scaled_resid = model.ln_final(resid_at_layers) # layer norm
        layer_logits = model.unembed(scaled_resid) # Shape: [n_layers, seq_len, d_vocab]

        # 4. Convert to probabilities
        layer_probs = layer_logits.softmax(dim=-1) # softmax, why dim=-1?

        # 5. Extract the probability of the *actual next token* for each position
        # We shift the tokens by 1 to get the 'next' token
        next_tokens = tokens[0, 1:] # what is this formatting?
        # We drop the last position in our predictions since we don't have the true next token for it
        layer_probs_for_next_token = layer_probs[:, :-1, :]

        # Gather the probabilities corresponding to the actual next tokens
        n_layers, seq_len_minus_1, d_vocab = layer_probs_for_next_token.shape
        gathered_probs = torch.gather(
            layer_probs_for_next_token,
            dim=-1,
            index=next_tokens.view(1, seq_len_minus_1, 1).expand(n_layers, -1, 1)
        ).squeeze(-1)

        # 6. Plot the heatmap
        # Get string representations of the tokens for the x-axis
        token_strings = model.to_str_tokens(tokens)[1:]

        heatmap_2d_array = gathered_probs.float().cpu().tolist()

        return {
            "x_labels": token_strings,
            "y_labels": labels, # (e.g., "blocks.0.hook_resid_post")
            "heatmap_data": heatmap_2d_array
        }

        # NO PLOTLY

        # Keep x, y
        # Export gathered_probs as rows in a heatmap_data object

        # fig = px.imshow(
        #     gathered_probs.float().cpu().numpy(),
        #     labels={"x": "Next Token", "y": "Layer", "color": "Probability"},
        #     x=token_strings,
        #     y=labels,
        #     title="Logit Lens: Probability of Next Token Across Layers",
        #     color_continuous_scale="Blues",
        #     aspect="auto"
        # )
        # fig.update_xaxes(tickangle=45)
        # fig.show()
        
        # --- DUMMY DATA FOR NOW ---
        # It's highly recommended to make the API return fake data first 
        # just to ensure the Next.js connection works!

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
