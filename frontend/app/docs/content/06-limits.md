---
title: Limits
---

Current limits, all subject to change during the beta:

- Prompts are capped at 48 tokens (as tokenized by the model you picked). This keeps runs cheap and the visualizations readable.
- 3 jobs in flight per account at a time.
- Attention pattern runs use only the first 30 tokens of the prompt.
- Steering pairs (your seed pair plus generated ones) are capped per GPU tier: 40 on L4, 25 on L40S, 15 on A100, 10 on H200 and B200. Generation length is capped at 500 tokens.
- Models over 100B parameters are rejected.

If one of these caps is blocking something real you are trying to do, email us. Several of them are conservative defaults rather than hard constraints.
