---
title: Models and GPU tiers
---

You can run any HuggingFace causal language model that TransformerLens can load, up to just about 100B parameters. This limit was chosen to reflect what can be done currently on a single GPU with our set-up, and as with many things regarding this tool, may expand depending on affordability, speed increases, and so on. The featured list in the model picker curated to show some well-known models, but just below that, you can paste a HF repo ID into the text field to validate it. Validation checks that the repo exists and is loadable, counts its real parameters from the Hub's safetensors metadata, and assigns a GPU tier.

Some vision-language models work through their text tower, and LoRA or DoRA adapter repos are supported by merging the adapter onto its base model at load time.

Models load in bfloat16. Weights are cached on the worker's volume after the first download, so the first run on a model is the slow one. Expect speeds to drastically increase (link to modal) if you're using a cached model (which we show at the loading stage currently).

| Parameters | GPU | VRAM |
| --- | --- | --- |
| under 4B | L4 | 24 GB |
| 4B to 10B | L40S | 48 GB |
| 10B to 25B | A100-80GB | 80 GB |
| 25B to 69B | H200 | 141 GB |
| 70B to 100B | B200 | 192 GB |

Attribution and activation patching need gradients or extra forward-pass headroom, so they may run a size class higher than the model's base tier. Importantly, running on an A100 or larger requires a verified payment method on the account. This was implemented as an anti-abuse measure since very large models can quickly consume usage.
