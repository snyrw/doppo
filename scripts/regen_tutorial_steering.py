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

SEED_FR = "Quel est le sens de la vie ?"
SEED_EN = "What is the meaning of life?"
GENERATION_PROMPT_1 = "I'm a bit hungry. Can you come up with a recipe that's cheap and easy to make?"
GENERATION_PROMPT_2 = "Who was Doppo Kunikida?"
GENERATION_PROMPT_3 = "Have the Seattle Mariners ever won the World Series?"
N_PAIRS = 100
# Unnormalized DIM vector: alpha=1 is one full unit (Arditi et al.'s reference
# coefficient) — kept as-is rather than hand-tuned.
ALPHA = 1.0


def _call_haiku(api_key, messages):
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


def _parse_pairs_array(text):
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
    try:
        return json.loads(text.strip())
    except json.JSONDecodeError:
        return []


def generate_pairs_with_claude(seed_fr, seed_en, n):
    """Haiku often undershoots a large explicit count in one shot, so top off
    with follow-up turns instead of trusting a single call to hit n."""
    api_key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not api_key:
        raise RuntimeError("ANTHROPIC_API_KEY is not set")

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

    messages = [{"role": "user", "content": prompt}]
    generated = []
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


def post_json(url, payload):
    data = json.dumps(payload).encode()
    req = urllib.request.Request(url, data=data, headers=_backend_headers({"Content-Type": "application/json"}), method="POST")
    try:
        with urllib.request.urlopen(req, timeout=600, context=_ssl_ctx) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        body = e.read().decode(errors="replace")
        raise RuntimeError(f"HTTP {e.code} from {url}: {body}") from e


def get_json(url):
    req = urllib.request.Request(url, headers=_backend_headers())
    with urllib.request.urlopen(req, timeout=60, context=_ssl_ctx) as resp:
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

    print("Generating pairs with Claude Haiku...")
    pairs = generate_pairs_with_claude(SEED_FR, SEED_EN, n=N_PAIRS)
    clean_prompts = [p[0] for p in pairs]
    corrupted_prompts = [p[1] for p in pairs]
    extra_pairs_out = [{"clean": c, "corrupted": r} for c, r in zip(clean_prompts[1:], corrupted_prompts[1:])]

    extra_pairs_payload = [{"clean": c, "corrupted": r} for c, r in zip(clean_prompts[1:], corrupted_prompts[1:])]
    base_payload = {
        "model_name": "meta-llama/Meta-Llama-3.1-8B-Instruct",
        "clean_prompt": clean_prompts[0],
        "corrupted_prompt": corrupted_prompts[0],
        "extra_pairs": extra_pairs_payload,
        "alpha": ALPHA,
        "temperature": 0.0,
        "repetition_penalty": 1.0,
        "n_tokens": 40,
        "target_position": "last",
        "components": [{"layer": 16}],
    }
    base_card = {
        "cardType": "steering",
        "modelName": "meta-llama/Meta-Llama-3.1-8B-Instruct",
        "cleanPrompt": clean_prompts[0],
        "corruptedPrompt": corrupted_prompts[0],
        "gpuTier": "tl_medium",
        "alpha": ALPHA,
        "temperature": 0.0,
        "repetitionPenalty": 1.0,
        "nTokens": 40,
        "nPairs": len(clean_prompts),
        "components": [{"layer": 16}],
    }

    print(f"\nStep 6 — layer 16, prompt 1 ({len(clean_prompts)} pairs)...")
    data_1 = spawn_and_poll(
        f"{API_URL}/api/job/spawn-steering",
        {**base_payload, "generation_prompt": GENERATION_PROMPT_1},
        "steering (prompt 1)",
    )

    print(f"\nStep 6 — layer 16, prompt 2 ({len(clean_prompts)} pairs)...")
    data_2 = spawn_and_poll(
        f"{API_URL}/api/job/spawn-steering",
        {**base_payload, "generation_prompt": GENERATION_PROMPT_2},
        "steering (prompt 2)",
    )

    print(f"\nStep 6 — layer 16, prompt 3 ({len(clean_prompts)} pairs)...")
    data_3 = spawn_and_poll(
        f"{API_URL}/api/job/spawn-steering",
        {**base_payload, "generation_prompt": GENERATION_PROMPT_3},
        "steering (prompt 3)",
    )

    existing["steps"]["5"] = {
        **base_card,
        "generationPrompt": GENERATION_PROMPT_1,
        "extraPairs": extra_pairs_out,
        "position": {"x": 1320, "y": 560},
        "data": data_1,
    }
    existing["steps"]["5b"] = {
        **base_card,
        "generationPrompt": GENERATION_PROMPT_2,
        "extraPairs": [],
        "position": {"x": 1820, "y": 560},
        "data": data_2,
    }
    existing["steps"]["5c"] = {
        **base_card,
        "generationPrompt": GENERATION_PROMPT_3,
        "extraPairs": [],
        "position": {"x": 2320, "y": 560},
        "data": data_3,
    }

    OUT_PATH.write_text(json.dumps(existing, indent=2, ensure_ascii=False))
    print(f"\nWrote {OUT_PATH}")

    print("\n=== Layer 16, prompt 1 ===")
    print("Steered:", data_1.get("steered_text", "N/A"))
    print(f"logit_diff: {data_1.get('logit_diff', 'N/A')}")

    print("\n=== Layer 16, prompt 2 ===")
    print("Steered:", data_2.get("steered_text", "N/A"))
    print(f"logit_diff: {data_2.get('logit_diff', 'N/A')}")

    print("\n=== Layer 16, prompt 3 ===")
    print("Steered:", data_3.get("steered_text", "N/A"))
    print(f"logit_diff: {data_3.get('logit_diff', 'N/A')}")

    print("\nDone. Commit frontend/app/tutorial/data.json.")


if __name__ == "__main__":
    main()
