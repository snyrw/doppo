#!/usr/bin/env python3
"""
scripts/generate_tutorial_data.py

Calls the deployed Modal backend for each of the 6 tutorial analyses
and writes results to frontend/app/tutorial/data.json.

Requirements:
  - NEXT_PUBLIC_API_URL set in environment or frontend/.env.local
  - ANTHROPIC_API_KEY set in environment or frontend/.env.local (for pair generation)
  - The Modal backend must be deployed (modal deploy backend/main.py)

Usage:
  python scripts/generate_tutorial_data.py
"""

import json
import os
import ssl
import sys
import time
from pathlib import Path
import urllib.request
import urllib.error

# macOS Python from python.org lacks the system CA bundle; bypass for this local script.
_ssl_ctx = ssl._create_unverified_context()

env_path = Path(__file__).parent.parent / "frontend" / ".env.local"
if env_path.exists():
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, _, v = line.partition("=")
            os.environ.setdefault(k.strip(), v.strip())

API_URL = os.environ.get("NEXT_PUBLIC_API_URL", "").rstrip("/")
if not API_URL:
    print("ERROR: NEXT_PUBLIC_API_URL is not set.", file=sys.stderr)
    sys.exit(1)

OUT_PATH = Path(__file__).parent.parent / "frontend" / "app" / "tutorial" / "data.json"

IOI_CLEAN     = "When Mary and John went to the store, John gave a drink to"
IOI_CORRUPTED = "When John and Mary went to the store, Mary gave a drink to"

# Steering step: seed pair (question-format prompts someone would ask an LLM)
SEED_EN = "What is the best way to learn a new language?"
SEED_FR = "Quelle est la meilleure façon d'apprendre une nouvelle langue?"

# Separate prompt used for generation (DIM direction applied here, not the seed pair)
GENERATION_PROMPT = "What do you think about climate change?"

N_PAIRS = 40


def generate_pairs_with_claude(seed_en: str, seed_fr: str, n: int) -> list[tuple[str, str]]:
    """Call Claude Haiku to generate n English/French LLM-question pairs based on the seed."""
    api_key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not api_key:
        raise RuntimeError("ANTHROPIC_API_KEY is not set — needed for pair generation")

    prompt = (
        f"Generate {n - 1} English/French question pairs in the same style as this seed:\n"
        f"English: \"{seed_en}\"\n"
        f"French: \"{seed_fr}\"\n\n"
        "Requirements:\n"
        "- Each English question should be something someone would genuinely ask an LLM "
        "(e.g. asking for explanations, opinions, recommendations, comparisons, how-tos)\n"
        "- The French translation must be natural and idiomatic — not word-for-word\n"
        "- Cover varied topics: science, culture, advice, philosophy, technology, everyday life, etc.\n"
        "- Do NOT repeat the seed pair or reuse its exact topic\n\n"
        "Return ONLY a JSON array of [english, french] pairs with no other text:\n"
        "[[\"english question\", \"french translation\"], ...]"
    )

    payload = {
        "model": "claude-haiku-4-5-20251001",
        "max_tokens": 4096,
        "messages": [{"role": "user", "content": prompt}],
    }
    data = json.dumps(payload).encode()
    req = urllib.request.Request(
        "https://api.anthropic.com/v1/messages",
        data=data,
        headers={
            "Content-Type": "application/json",
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=60, context=_ssl_ctx) as resp:
        result = json.loads(resp.read())

    text = result["content"][0]["text"].strip()
    # Strip markdown code fences if Haiku wraps the JSON
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
    generated = json.loads(text.strip())

    pairs = [(seed_en, seed_fr)] + [(p[0], p[1]) for p in generated[: n - 1]]
    print(f"  Generated {len(pairs)} pairs (seed + {len(pairs) - 1} from Claude Haiku)", flush=True)
    return pairs


def _backend_headers(extra=None):
    """The Modal backend requires the shared bearer secret on every route.
    BACKEND_API_SECRET is read from the env (or frontend/.env.local above)."""
    headers = dict(extra or {})
    secret = os.environ.get("BACKEND_API_SECRET", "")
    if secret:
        headers["Authorization"] = f"Bearer {secret}"
    return headers


def post_json(url: str, payload: dict) -> dict:
    data = json.dumps(payload).encode()
    req = urllib.request.Request(url, data=data, headers=_backend_headers({"Content-Type": "application/json"}), method="POST")
    try:
        with urllib.request.urlopen(req, timeout=600, context=_ssl_ctx) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        body = e.read().decode(errors="replace")
        raise RuntimeError(f"HTTP {e.code} from {url}: {body}") from e

def get_json(url: str) -> dict:
    req = urllib.request.Request(url, headers=_backend_headers())
    with urllib.request.urlopen(req, timeout=60, context=_ssl_ctx) as resp:
        return json.loads(resp.read())

def spawn_and_poll(spawn_url: str, payload: dict, label: str) -> dict:
    print(f"  Spawning {label}...", flush=True)
    result = post_json(spawn_url, payload)
    if result.get("status") == "cached":
        print(f"  {label}: cache hit", flush=True)
        return result["data"]
    job_id = result["job_id"]
    print(f"  {label}: job {job_id}, polling...", flush=True)
    while True:
        time.sleep(5)
        status = get_json(f"{API_URL}/api/job/{job_id}")
        if status["status"] == "done":
            print(f"  {label}: done", flush=True)
            return status["data"]
        if status["status"] == "error":
            raise RuntimeError(f"{label} failed: {status.get('error')}")
        print(f"  {label}: {status['status']}...", flush=True)

def main():
    print(f"Backend: {API_URL}")
    print(f"Output:  {OUT_PATH}\n")

    steps = {}

    # Step 0: Logit Lens
    print("Step 0: Logit Lens")
    data = spawn_and_poll(
        f"{API_URL}/api/job/spawn-lens",
        {"model_name": "openai-community/gpt2", "prompt": IOI_CLEAN, "top_k": 5},
        "logit-lens",
    )
    steps["0"] = {
        "cardType": "logit-lens",
        "modelName": "openai-community/gpt2",
        "prompt": IOI_CLEAN,
        "gpuTier": "tl_small",
        "position": {"x": 80, "y": 80},
        "data": data,
    }

    # Step 1: Attention Patterns
    print("\nStep 1: Attention Patterns")
    data = spawn_and_poll(
        f"{API_URL}/api/job/spawn-attn",
        {"model_name": "openai-community/gpt2", "prompt": IOI_CLEAN},
        "attention",
    )
    steps["1"] = {
        "cardType": "attention-pattern",
        "modelName": "openai-community/gpt2",
        "prompt": IOI_CLEAN,
        "gpuTier": "tl_small",
        "position": {"x": 700, "y": 80},
        "data": data,
    }

    # Step 2: DLA
    print("\nStep 2: DLA")
    data = spawn_and_poll(
        f"{API_URL}/api/job/spawn-dla",
        {"model_name": "openai-community/gpt2", "prompt": IOI_CLEAN,
         "target_position": "last", "target_token": " Mary", "contrastive_token": " John"},
        "dla",
    )
    steps["2"] = {
        "cardType": "dla",
        "modelName": "openai-community/gpt2",
        "prompt": IOI_CLEAN,
        "gpuTier": "tl_small",
        "targetPosition": "last",
        "targetToken": " Mary",
        "contrastiveToken": " John",
        "position": {"x": 80, "y": 560},
        "data": data,
    }

    # Step 3: Attribution
    print("\nStep 3: Attribution Patching")
    data = spawn_and_poll(
        f"{API_URL}/api/job/spawn-attribution",
        {"model_name": "openai-community/gpt2",
         "prompt": IOI_CLEAN, "corrupted_prompt": IOI_CORRUPTED,
         "target_position": "last", "target_token": " Mary", "contrastive_token": " John"},
        "attribution",
    )
    steps["3"] = {
        "cardType": "attribution",
        "modelName": "openai-community/gpt2",
        "cleanPrompt": IOI_CLEAN,
        "corruptedPrompt": IOI_CORRUPTED,
        "gpuTier": "tl_small",
        "targetPosition": "last",
        "targetToken": " Mary",
        "contrastiveToken": " John",
        "position": {"x": 700, "y": 560},
        "data": data,
    }

    # Step 4: Activation Patching (top 10 components from attribution)
    print("\nStep 4: Activation Patching")
    top_k = steps["3"]["data"].get("top_k_components", [])[:10]
    data = spawn_and_poll(
        f"{API_URL}/api/job/spawn-activation-patch",
        {"model_name": "openai-community/gpt2",
         "prompt": IOI_CLEAN, "corrupted_prompt": IOI_CORRUPTED,
         "target_position": "last", "target_token_idx": steps["3"]["data"]["target_token_idx"],
         "components": top_k},
        "activation-patch",
    )
    steps["4"] = {
        "cardType": "activation",
        "modelName": "openai-community/gpt2",
        "cleanPrompt": IOI_CLEAN,
        "corruptedPrompt": IOI_CORRUPTED,
        "gpuTier": "tl_small",
        "targetPosition": "last",
        "targetToken": " Mary",
        "contrastiveToken": " John",
        "k": 10,
        "parentAttributionId": "tutorial-3",
        "position": {"x": 1320, "y": 80},
        "data": data,
    }

    # Step 5: Steering (English → French on Qwen, pairs generated by Claude Haiku)
    print("\nStep 5: Steering (English → French, Qwen/Qwen2.5-1.5B-Instruct)")
    print("  Generating pairs with Claude Haiku...")
    pairs = generate_pairs_with_claude(SEED_EN, SEED_FR, n=N_PAIRS)
    clean_prompts = [p[0] for p in pairs]
    corrupted_prompts = [p[1] for p in pairs]

    alpha = -20.0
    extra_pairs_list = [{"clean": c, "corrupted": r} for c, r in zip(clean_prompts[1:], corrupted_prompts[1:])]
    base_payload = {
        "model_name": "Qwen/Qwen2.5-1.5B-Instruct",
        "clean_prompt": clean_prompts[0],
        "corrupted_prompt": corrupted_prompts[0],
        "extra_pairs": extra_pairs_list,
        "alpha": alpha,
        "temperature": 1.0,
        "repetition_penalty": 1.3,
        "n_tokens": 40,
        "generation_prompt": GENERATION_PROMPT,
        "target_position": "last",
    }
    base_card = {
        "cardType": "steering",
        "modelName": "Qwen/Qwen2.5-1.5B-Instruct",
        "cleanPrompt": clean_prompts[0],
        "corruptedPrompt": corrupted_prompts[0],
        "gpuTier": "tl_small",
        "alpha": alpha,
        "temperature": 1.0,
        "repetitionPenalty": 1.3,
        "nTokens": 40,
        "nPairs": len(pairs),
    }
    print("  Spawning layer 14...")
    data_14 = spawn_and_poll(
        f"{API_URL}/api/job/spawn-steering",
        {**base_payload, "components": [{"layer": 14, "head": None, "injection_type": "residual"}]},
        "steering (layer 14)",
    )
    print("  Spawning layer 16...")
    data_16 = spawn_and_poll(
        f"{API_URL}/api/job/spawn-steering",
        {**base_payload, "components": [{"layer": 16, "head": None, "injection_type": "residual"}]},
        "steering (layer 16)",
    )
    steps["5"] = {
        **base_card,
        "extraPairs": extra_pairs_list,
        "components": [{"layer": 14, "head": None, "injectionType": "residual"}],
        "position": {"x": 1320, "y": 560},
        "data": data_14,
    }
    steps["5b"] = {
        **base_card,
        "extraPairs": [],
        "components": [{"layer": 16, "head": None, "injectionType": "residual"}],
        "position": {"x": 1800, "y": 560},
        "data": data_16,
    }

    output = {"_ready": True, "steps": steps}
    OUT_PATH.write_text(json.dumps(output, indent=2, ensure_ascii=False))
    print(f"\nWrote {OUT_PATH}")
    print("Done. Commit frontend/app/tutorial/data.json to the repository.")

if __name__ == "__main__":
    main()
