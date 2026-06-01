#!/usr/bin/env python3
"""
scripts/generate_tutorial_data.py

Calls the deployed Modal backend for each of the 6 tutorial analyses
and writes results to frontend/app/tutorial/data.json.

Requirements:
  - NEXT_PUBLIC_API_URL set in environment or .env.local in the project root
  - The Modal backend must be deployed (modal deploy backend/main.py)

Usage:
  python scripts/generate_tutorial_data.py
"""

import json
import os
import sys
import time
from pathlib import Path
import urllib.request
import urllib.error

env_path = Path(__file__).parent.parent / ".env.local"
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

ENGLISH_FRENCH_PAIRS = [
    ["The weather today is sunny and warm.", "Le temps aujourd'hui est ensoleillé et chaud."],
    ["I would like to order a coffee, please.", "Je voudrais commander un café, s'il vous plaît."],
    ["The book is on the table.", "Le livre est sur la table."],
    ["She walks to the market every morning.", "Elle marche au marché chaque matin."],
    ["The train arrives at seven o'clock.", "Le train arrive à sept heures."],
    ["Can you help me find the station?", "Pouvez-vous m'aider à trouver la gare?"],
    ["He reads the newspaper before breakfast.", "Il lit le journal avant le petit-déjeuner."],
    ["The children are playing in the garden.", "Les enfants jouent dans le jardin."],
    ["We need to leave early tomorrow.", "Nous devons partir tôt demain."],
    ["The restaurant is next to the hotel.", "Le restaurant est à côté de l'hôtel."],
    ["Please close the window, it's cold.", "Veuillez fermer la fenêtre, il fait froid."],
    ["My name is Alice and I live in Paris.", "Je m'appelle Alice et j'habite à Paris."],
    ["The meeting starts at two in the afternoon.", "La réunion commence à deux heures de l'après-midi."],
    ["Do you know where the library is?", "Savez-vous où se trouve la bibliothèque?"],
    ["This is a beautiful city with many museums.", "C'est une belle ville avec de nombreux musées."],
    ["I am learning to speak a new language.", "J'apprends à parler une nouvelle langue."],
    ["The cat is sleeping on the sofa.", "Le chat dort sur le canapé."],
    ["She finished her work before lunch.", "Elle a terminé son travail avant le déjeuner."],
    ["The flowers in the garden are blooming.", "Les fleurs dans le jardin s'épanouissent."],
    ["He asked for directions to the airport.", "Il a demandé son chemin pour aller à l'aéroport."],
]

def post_json(url: str, payload: dict) -> dict:
    data = json.dumps(payload).encode()
    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=600) as resp:
        return json.loads(resp.read())

def get_json(url: str) -> dict:
    with urllib.request.urlopen(url, timeout=60) as resp:
        return json.loads(resp.read())

def spawn_and_poll(spawn_url: str, payload: dict, label: str) -> dict:
    print(f"  Spawning {label}...", flush=True)
    result = post_json(spawn_url, payload)
    if result.get("status") == "cached":
        print(f"  {label}: cache hit", flush=True)
        return result["data"]
    job_id = result["jobId"]
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
         "clean_prompt": IOI_CLEAN, "corrupted_prompt": IOI_CORRUPTED,
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
         "clean_prompt": IOI_CLEAN, "corrupted_prompt": IOI_CORRUPTED,
         "target_position": "last", "target_token_idx": steps["3"]["data"]["target_token_idx"],
         "top_k_components": top_k},
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

    # Step 5: Steering (English → French on Qwen)
    print("\nStep 5: Steering (English → French, Qwen/Qwen2.5-1.5B-Instruct)")
    clean_prompts = [p[0] for p in ENGLISH_FRENCH_PAIRS]
    corrupted_prompts = [p[1] for p in ENGLISH_FRENCH_PAIRS]
    data = spawn_and_poll(
        f"{API_URL}/api/job/spawn-steering",
        {
            "model_name": "Qwen/Qwen2.5-1.5B-Instruct",
            "clean_prompt": clean_prompts[0],
            "corrupted_prompt": corrupted_prompts[0],
            "extra_pairs": [{"clean": c, "corrupted": r} for c, r in zip(clean_prompts[1:], corrupted_prompts[1:])],
            "components": [{"layer": 16, "head": None, "injection_type": "residual"}],
            "alpha": 15.0,
            "temperature": 1.0,
            "repetition_penalty": 1.0,
            "n_tokens": 30,
            "generation_prompt": clean_prompts[0],
            "target_position": "last",
            "target_token": None,
        },
        "steering",
    )
    steps["5"] = {
        "cardType": "steering",
        "modelName": "Qwen/Qwen2.5-1.5B-Instruct",
        "cleanPrompt": clean_prompts[0],
        "corruptedPrompt": corrupted_prompts[0],
        "gpuTier": "tl_small",
        "components": [{"layer": 16, "head": None, "injectionType": "residual"}],
        "alpha": 15.0,
        "temperature": 1.0,
        "repetitionPenalty": 1.0,
        "nTokens": 30,
        "nPairs": len(ENGLISH_FRENCH_PAIRS),
        "position": {"x": 1320, "y": 560},
        "data": data,
    }

    output = {"_ready": True, "steps": steps}
    OUT_PATH.write_text(json.dumps(output, indent=2, ensure_ascii=False))
    print(f"\nWrote {OUT_PATH}")
    print("Done. Commit frontend/app/tutorial/data.json to the repository.")

if __name__ == "__main__":
    main()
