import threading
from collections import OrderedDict

from fastapi import APIRouter, HTTPException

from ..schemas import TokenizeRequest, ValidateModelRequest
from ..config import FEATURED_MODELS
from ..validation import validate_hf_repo

# Bound the per-worker caches so a flood of distinct model IDs can't grow memory
# without limit (each tokenizer entry downloads + holds a tokenizer object).
_TOKENIZER_CACHE_MAX = 16
_VALIDATION_CACHE_MAX = 64


class _LruCache:
    """Tiny thread-safe LRU. Sync routes run in Starlette's threadpool (up to
    @modal.concurrent(max_inputs=50) at once), so the underlying OrderedDict
    must not be mutated concurrently — and a get must not race an eviction."""

    def __init__(self, max_size: int):
        self._data: OrderedDict = OrderedDict()
        self._max = max_size
        self._lock = threading.Lock()

    def get(self, key):
        with self._lock:
            if key not in self._data:
                return None
            self._data.move_to_end(key)
            return self._data[key]

    def put(self, key, value):
        with self._lock:
            self._data[key] = value
            self._data.move_to_end(key)
            if len(self._data) > self._max:
                self._data.popitem(last=False)


def create_router(hf_token):
    router = APIRouter()
    _tokenizer_cache = _LruCache(_TOKENIZER_CACHE_MAX)
    _validation_cache = _LruCache(_VALIDATION_CACHE_MAX)

    def _validate_repo_cached(repo_id: str) -> dict:
        """validate_hf_repo with a per-worker cache: it costs 2-3 HF hub round
        trips, and /api/tokenize would otherwise repeat them on every request."""
        result = _validation_cache.get(repo_id)
        if result is None:
            result = validate_hf_repo(repo_id, hf_token)
            # Only cache positive results — a transient hub error or a repo that
            # gets fixed shouldn't be pinned as invalid for the worker's lifetime.
            if result["valid"]:
                _validation_cache.put(repo_id, result)
        return result

    @router.post("/api/tokenize")
    def tokenize_text(request: TokenizeRequest):
        from transformers.models.auto.tokenization_auto import AutoTokenizer

        entry = FEATURED_MODELS.get(request.model_name)
        if entry is None:
            # Non-featured IDs are arbitrary user input — run the same safety gate
            # used by /api/validate-model before loading the tokenizer (blocks
            # trust_remote_code / custom auto_map / pickle-only repos).
            check = _validate_repo_cached(request.model_name)
            if not check["valid"]:
                raise HTTPException(status_code=400, detail=check["reason"])
        hf_model_id = entry["model_id"] if entry else request.model_name
        tok_token = hf_token if (entry is None or entry.get("requires_hf_token")) else None

        tokenizer = _tokenizer_cache.get(hf_model_id)
        if tokenizer is None:
            tokenizer = AutoTokenizer.from_pretrained(hf_model_id, token=tok_token)
            _tokenizer_cache.put(hf_model_id, tokenizer)
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
        result = _validate_repo_cached(request.repo_id)
        if not result["valid"]:
            raise HTTPException(status_code=400, detail=result["reason"])
        return result

    return router
