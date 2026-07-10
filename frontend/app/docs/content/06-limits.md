---
title: Limits
---

Here is a short list of some intentional limits that have been set:

- Prompts are capped at 48 tokens (as tokenized by the model you picked). This keeps runs cheap and the visualizations readable.
- 3 jobs in flight per account at a time.
- Attention pattern runs use only the first 30 tokens of the prompt.
- Steering pairs (your seed pair plus generated ones) are capped at 100, which is roughly where difference-in-means vectors stabilize across resamples. Generation length is capped at 500 tokens.
- Models over 100B parameters are rejected.

If one of these caps is blocking something real you are trying to do, feel free to reach out! Some might be working constraints that can be adjusted, while others are necessary if arbitrary to keep things financially sustainable.
