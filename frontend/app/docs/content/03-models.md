---
title: Models and GPU tiers
---

You can run a good amount of HuggingFace transformers that TransformerLens 3.0+ can load up to just about 100B parameters. The featured list in the model picker is curated to show some well-known models, but just below that, you can paste a HF repo ID into the text field to validate it. Validation checks that the repo exists and is secure enough to run on a hosted web tool. LoRA and DoRA adapter repos work as well since we just merge the adapter onto its base model at load time.

| Parameters | GPU | VRAM |
| --- | --- | --- |
| under 4B | L4 | 24 GB |
| 4B to 10B | L40S | 48 GB |
| 10B to 25B | A100-80GB | 80 GB |
| 25B to 69B | H200 | 141 GB |
| 70B to 100B | B200 | 192 GB |

It should be noted that attribution and activation patching need gradients or extra forward-pass headroom, so they may run a size class higher than the model's base tier. There are intentionally few limits on our compute for the moment, but this may be reconsidered if there is a spike in abuse.