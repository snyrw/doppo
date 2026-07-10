---
title: Models and GPU tiers
---

You can run any HuggingFace causal language model that TransformerLens can load, up to just about 100B parameters. This limit was chosen to reflect what can be done currently on a single GPU with our set-up, and as with many things regarding this tool, may expand depending on affordability, speed increases, and so on. The featured list in the model picker is curated to show some well-known models, but just below that, you can paste a HF repo ID into the text field to validate it. Validation checks that the repo exists and is secure enough to run on a hosted web tool.

| Parameters | GPU | VRAM |
| --- | --- | --- |
| under 4B | L4 | 24 GB |
| 4B to 10B | L40S | 48 GB |
| 10B to 25B | A100-80GB | 80 GB |
| 25B to 69B | H200 | 141 GB |
| 70B to 100B | B200 | 192 GB |

Attribution and activation patching need gradients or extra forward-pass headroom, so they may run a size class higher than the model's base tier. As an anti-abuse measure, running on an A100 or larger requires a verified payment method on the account.
