#!/usr/bin/env python3
"""
scripts/generate_tutorial_data.py

Calls the deployed Modal backend for each of the 6 tutorial analyses
and writes results to frontend/app/tutorial/data.json.

Requirements:
  - NEXT_PUBLIC_API_URL set in environment or frontend/.env.local
  - ANTHROPIC_API_KEY set in environment or frontend/.env.local (for pair generation)
  - The Modal backend must be deployed (modal deploy -m backend.main)

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

# Steering step: seed pair (question-format prompts someone would ask an LLM).
# clean = French, corrupted = English, so the DIM vector points EN → FR and
# positive alpha steers toward French. Must stay in sync with
# scripts/regen_tutorial_steering.py — the steering-only regen path.
SEED_FR = "Quel est le sens de la vie ?"
SEED_EN = "What is the meaning of life?"

# Separate prompts used for generation (DIM direction applied here, not the seed
# pair) — three cards, same layer-16 vector, different prompts.
GENERATION_PROMPT_1 = "I'm a bit hungry. Can you come up with a recipe that's cheap and easy to make?"
GENERATION_PROMPT_2 = "Who was Doppo Kunikida?"
GENERATION_PROMPT_3 = "Have the Seattle Mariners ever won the World Series?"

N_PAIRS = 100
# Unnormalized DIM vector: alpha=1 is one full unit (Arditi et al.'s reference
# coefficient) — kept as-is rather than hand-tuned.
ALPHA = 1.0


def _call_haiku(api_key: str, messages: list[dict]) -> str:
    payload = {
        "model": "claude-haiku-4-5-20251001",
        "max_tokens": 16000,
        "messages": messages,
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
    return result["content"][0]["text"].strip()


def _parse_pairs_array(text: str) -> list:
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
    try:
        return json.loads(text.strip())
    except json.JSONDecodeError:
        return []


def generate_pairs_with_claude(seed_fr: str, seed_en: str, n: int) -> list[tuple[str, str]]:
    """Call Claude Haiku to generate n French/English LLM-question pairs based on the seed.

    Haiku often undershoots a large explicit count in one shot, so top off with
    follow-up turns instead of trusting a single call to hit n.
    """
    api_key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not api_key:
        raise RuntimeError("ANTHROPIC_API_KEY is not set — needed for pair generation")

    n_needed = n - 1  # pairs beyond the seed
    prompt = (
        f"Generate {n_needed} French/English question pairs in the same style as this seed:\n"
        f"French: \"{seed_fr}\"\n"
        f"English: \"{seed_en}\"\n\n"
        "Requirements:\n"
        "- Each French question should be something someone would genuinely ask an LLM "
        "(e.g. asking for explanations, opinions, recommendations, comparisons, how-tos)\n"
        "- The English translation must be natural and idiomatic — not word-for-word\n"
        "- Cover varied topics: science, culture, advice, philosophy, technology, everyday life, etc.\n"
        "- Do NOT repeat the seed pair or reuse its exact topic\n\n"
        "Return ONLY a JSON array of [french, english] pairs with no other text:\n"
        "[[\"french question\", \"english translation\"], ...]"
    )

    messages: list[dict] = [{"role": "user", "content": prompt}]
    generated: list = []
    for _attempt in range(3):
        text = _call_haiku(api_key, messages)
        new_pairs = _parse_pairs_array(text)
        generated.extend(new_pairs[: n_needed - len(generated)])
        if len(generated) >= n_needed or not new_pairs:
            break
        messages.append({"role": "assistant", "content": text})
        messages.append({
            "role": "user",
            "content": (
                f"You've produced {len(generated)} valid pairs so far, but {n_needed} were "
                f"requested. Continue with {n_needed - len(generated)} more diverse pairs for "
                "the same seed — do not repeat any pair already generated. Output ONLY a JSON "
                "array of the new [french, english] pairs, no other text."
            ),
        })

    pairs = [(seed_fr, seed_en)] + [(p[0], p[1]) for p in generated[:n_needed]]
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

    # Step 4: Activation Patching (top 10 components from attribution).
    # contrastive_token_idx keeps the patching metric identical to the one
    # attribution ranked by — the IOI logit diff logit(Mary) - logit(John) —
    # matching what the app's Verify button sends (useJobHandlers.verifyTopK).
    print("\nStep 4: Activation Patching")
    top_k = steps["3"]["data"].get("top_k_components", [])[:10]
    data = spawn_and_poll(
        f"{API_URL}/api/job/spawn-activation-patch",
        {"model_name": "openai-community/gpt2",
         "prompt": IOI_CLEAN, "corrupted_prompt": IOI_CORRUPTED,
         "target_position": "last", "target_token_idx": steps["3"]["data"]["target_token_idx"],
         "contrastive_token_idx": steps["3"]["data"]["contrastive_token_idx"],
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

    # Step 5 (tutorial step 6): Steering (English → French on Qwen, pairs
    # generated by Claude Haiku). Three cards share one layer-16 DIM vector at
    # alpha = +20 and differ only in generation prompt. Keys "5"/"5b"/"5c";
    # only "5" stores extraPairs. Mirrors scripts/regen_tutorial_steering.py.
    print("\nStep 5: Steering (English → French, Qwen/Qwen2.5-7B-Instruct)")
    print("  Generating pairs with Claude Haiku...")
    pairs = generate_pairs_with_claude(SEED_FR, SEED_EN, n=N_PAIRS)
    clean_prompts = [p[0] for p in pairs]
    corrupted_prompts = [p[1] for p in pairs]

    extra_pairs_list = [{"clean": c, "corrupted": r} for c, r in zip(clean_prompts[1:], corrupted_prompts[1:])]
    base_payload = {
        "model_name": "Qwen/Qwen2.5-7B-Instruct",
        "clean_prompt": clean_prompts[0],
        "corrupted_prompt": corrupted_prompts[0],
        "extra_pairs": extra_pairs_list,
        "alpha": ALPHA,
        "temperature": 0.0,
        "repetition_penalty": 1.0,
        "n_tokens": 40,
        "target_position": "last",
        "components": [{"layer": 16}],
    }
    base_card = {
        "cardType": "steering",
        "modelName": "Qwen/Qwen2.5-7B-Instruct",
        "cleanPrompt": clean_prompts[0],
        "corruptedPrompt": corrupted_prompts[0],
        "gpuTier": "tl_medium",
        "alpha": ALPHA,
        "temperature": 0.0,
        "repetitionPenalty": 1.0,
        "nTokens": 40,
        "nPairs": len(pairs),
        "components": [{"layer": 16}],
    }
    print("  Spawning prompt 1...")
    data_1 = spawn_and_poll(
        f"{API_URL}/api/job/spawn-steering",
        {**base_payload, "generation_prompt": GENERATION_PROMPT_1},
        "steering (prompt 1)",
    )
    print("  Spawning prompt 2...")
    data_2 = spawn_and_poll(
        f"{API_URL}/api/job/spawn-steering",
        {**base_payload, "generation_prompt": GENERATION_PROMPT_2},
        "steering (prompt 2)",
    )
    print("  Spawning prompt 3...")
    data_3 = spawn_and_poll(
        f"{API_URL}/api/job/spawn-steering",
        {**base_payload, "generation_prompt": GENERATION_PROMPT_3},
        "steering (prompt 3)",
    )
    steps["5"] = {
        **base_card,
        "generationPrompt": GENERATION_PROMPT_1,
        "extraPairs": extra_pairs_list,
        "position": {"x": 1320, "y": 560},
        "data": data_1,
    }
    steps["5b"] = {
        **base_card,
        "generationPrompt": GENERATION_PROMPT_2,
        "extraPairs": [],
        "position": {"x": 1820, "y": 560},
        "data": data_2,
    }
    steps["5c"] = {
        **base_card,
        "generationPrompt": GENERATION_PROMPT_3,
        "extraPairs": [],
        "position": {"x": 2320, "y": 560},
        "data": data_3,
    }

    output = {"_ready": True, "steps": steps}
    OUT_PATH.write_text(json.dumps(output, indent=2, ensure_ascii=False))
    print(f"\nWrote {OUT_PATH}")
    print("Done. Commit frontend/app/tutorial/data.json to the repository.")

if __name__ == "__main__":
    main()
