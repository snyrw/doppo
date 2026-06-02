#!/usr/bin/env python3
"""
scripts/regen_tutorial_steering.py

Re-runs only the steering step (step 5) of the tutorial data, leaving
steps 0–4 in data.json untouched.

Requirements:
  - NEXT_PUBLIC_API_URL set in environment or frontend/.env.local
  - ANTHROPIC_API_KEY set in environment or frontend/.env.local

Usage:
  python scripts/regen_tutorial_steering.py
"""

import json
import os
import ssl
import sys
import time
from pathlib import Path
import urllib.request
import urllib.error

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

SEED_EN = "What is the best way to learn a new language?"
SEED_FR = "Quelle est la meilleure façon d'apprendre une nouvelle langue?"
GENERATION_PROMPT = "What do you think about climate change?"
N_PAIRS = 40
ALPHA = -20.0


def generate_pairs_with_claude(seed_en, seed_fr, n):
    api_key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not api_key:
        raise RuntimeError("ANTHROPIC_API_KEY is not set")

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
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
    generated = json.loads(text.strip())

    pairs = [(seed_en, seed_fr)] + [(p[0], p[1]) for p in generated[: n - 1]]
    print(f"  Generated {len(pairs)} pairs (seed + {len(pairs) - 1} from Claude Haiku)", flush=True)
    return pairs


def post_json(url, payload):
    data = json.dumps(payload).encode()
    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=600, context=_ssl_ctx) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        body = e.read().decode(errors="replace")
        raise RuntimeError(f"HTTP {e.code} from {url}: {body}") from e


def get_json(url):
    with urllib.request.urlopen(url, timeout=60, context=_ssl_ctx) as resp:
        return json.loads(resp.read())


def spawn_and_poll(spawn_url, payload, label):
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
    print(f"Output:  {OUT_PATH}")
    print(f"Alpha:   {ALPHA}\n")

    existing = json.loads(OUT_PATH.read_text())

    # Reuse stored extra pairs if available — skips the Claude Haiku API call.
    stored = existing.get("steps", {}).get("5", {})
    stored_extra = stored.get("extraPairs", [])
    if stored_extra:
        print(f"Reusing {len(stored_extra)} stored extra pairs from data.json (skipping Claude Haiku).")
        clean_prompts = [SEED_EN] + [p["clean"] for p in stored_extra]
        corrupted_prompts = [SEED_FR] + [p["corrupted"] for p in stored_extra]
        extra_pairs_out = stored_extra
    else:
        print("Generating pairs with Claude Haiku...")
        pairs = generate_pairs_with_claude(SEED_EN, SEED_FR, n=N_PAIRS)
        clean_prompts = [p[0] for p in pairs]
        corrupted_prompts = [p[1] for p in pairs]
        extra_pairs_out = [{"clean": c, "corrupted": r} for c, r in zip(clean_prompts[1:], corrupted_prompts[1:])]

    extra_pairs_payload = [{"clean": c, "corrupted": r} for c, r in zip(clean_prompts[1:], corrupted_prompts[1:])]
    base_payload = {
        "model_name": "Qwen/Qwen2.5-1.5B-Instruct",
        "clean_prompt": clean_prompts[0],
        "corrupted_prompt": corrupted_prompts[0],
        "extra_pairs": extra_pairs_payload,
        "alpha": ALPHA,
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
        "alpha": ALPHA,
        "temperature": 1.0,
        "repetitionPenalty": 1.3,
        "nTokens": 40,
        "nPairs": len(clean_prompts),
    }

    print(f"\nStep 5 — layer 14 ({len(clean_prompts)} pairs)...")
    data_14 = spawn_and_poll(
        f"{API_URL}/api/job/spawn-steering",
        {**base_payload, "components": [{"layer": 14, "head": None, "injection_type": "residual"}]},
        "steering (layer 14)",
    )

    print(f"\nStep 5b — layer 16 ({len(clean_prompts)} pairs)...")
    data_16 = spawn_and_poll(
        f"{API_URL}/api/job/spawn-steering",
        {**base_payload, "components": [{"layer": 16, "head": None, "injection_type": "residual"}]},
        "steering (layer 16)",
    )

    existing["steps"]["5"] = {
        **base_card,
        "extraPairs": extra_pairs_out,
        "components": [{"layer": 14, "head": None, "injectionType": "residual"}],
        "position": {"x": 1320, "y": 560},
        "data": data_14,
    }
    existing["steps"]["5b"] = {
        **base_card,
        "extraPairs": [],
        "components": [{"layer": 16, "head": None, "injectionType": "residual"}],
        "position": {"x": 1800, "y": 560},
        "data": data_16,
    }

    OUT_PATH.write_text(json.dumps(existing, indent=2, ensure_ascii=False))
    print(f"\nWrote {OUT_PATH}")

    print("\n=== Layer 14 ===")
    print("Steered:", data_14.get("steered_text", "N/A"))
    print(f"logit_diff: {data_14.get('logit_diff', 'N/A')}")

    print("\n=== Layer 16 ===")
    print("Steered:", data_16.get("steered_text", "N/A"))
    print(f"logit_diff: {data_16.get('logit_diff', 'N/A')}")

    print("\nDone. Commit frontend/app/tutorial/data.json.")


if __name__ == "__main__":
    main()
