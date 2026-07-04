---
title: Models and GPU tiers
---

You can run any HuggingFace causal language model that TransformerLens can load, up to about 100B parameters. The featured list in the model picker is a curation, not a gate: paste any repo ID into the text field and validate it. Validation checks that the repo exists and is loadable, counts its real parameters from the Hub's safetensors metadata (so MoE models like Mixtral size by their true count, not their layer shape), and assigns a GPU tier.

Some vision-language models work through their text tower, and LoRA or DoRA adapter repos are supported by merging the adapter onto its base model at load time. Models over 100B parameters are rejected; there is no multi-GPU support.

Models load in bfloat16. Weights are cached on the worker's volume after the first download, so the first run on a model is the slow one.

| Parameters | GPU | VRAM |
| --- | --- | --- |
| under 4B | L4 | 24 GB |
| 4B to 10B | L40S | 48 GB |
| 10B to 25B | A100-80GB | 80 GB |
| 25B to 69B | H200 | 141 GB |
| 70B to 100B | B200 | 192 GB |

Attribution and activation patching need gradients or extra forward-pass headroom, so they may run a size class higher than the model's base tier. Running on an A100 or larger requires a verified payment method on the account; this is an anti-abuse measure, not a paywall on the features themselves.
