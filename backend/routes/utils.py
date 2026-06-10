from fastapi import APIRouter, HTTPException

from ..schemas import TokenizeRequest, ValidateModelRequest
from ..config import FEATURED_MODELS
from ..validation import validate_hf_repo


def create_router(hf_token):
    router = APIRouter()
    _tokenizer_cache: dict = {}

    @router.post("/api/tokenize")
    def tokenize_text(request: TokenizeRequest):
        from transformers.models.auto.tokenization_auto import AutoTokenizer

        entry = FEATURED_MODELS.get(request.model_name)
        if entry is None:
            # Non-featured IDs are arbitrary user input — run the same safety gate
            # used by /api/validate-model before loading the tokenizer (blocks
            # trust_remote_code / custom auto_map / pickle-only repos).
            check = validate_hf_repo(request.model_name, hf_token)
            if not check["valid"]:
                raise HTTPException(status_code=400, detail=check["reason"])
        hf_model_id = entry["model_id"] if entry else request.model_name
        tok_token = hf_token if (entry is None or entry.get("requires_hf_token")) else None

        if hf_model_id not in _tokenizer_cache:
            _tokenizer_cache[hf_model_id] = AutoTokenizer.from_pretrained(
                hf_model_id, token=tok_token
            )

        tokenizer = _tokenizer_cache[hf_model_id]
        ids = tokenizer.encode(request.text, add_special_tokens=True)
        special_ids = set(tokenizer.all_special_ids)
        tokens = []
        for i in ids:
            text = tokenizer.decode([i], skip_special_tokens=False)
            if not text and i in special_ids:
                toks = tokenizer.convert_ids_to_tokens([i])
                text = toks[0] if toks else f"[{i}]"
            tokens.append({"text": text, "special": i in special_ids})
        return {"tokens": tokens}

    @router.get("/api/models")
    def list_models():
        return [
            {
                "id": key,
                "display_name": entry["display_name"],
                "description": entry["description"],
                "requires_hf_token": entry["requires_hf_token"],
                "gpu_tier": entry["gpu_tier"],
            }
            for key, entry in FEATURED_MODELS.items()
        ]

    @router.post("/api/validate-model")
    def validate_model(request: ValidateModelRequest):
        result = validate_hf_repo(request.repo_id, hf_token)
        if not result["valid"]:
            raise HTTPException(status_code=400, detail=result["reason"])
        return result

    return router
