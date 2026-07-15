---
title: Limits
---

Here's a short list of some intentional limits that have been set:

- Prompts are capped at 48 tokens (as tokenized by the model you picked) for most cards, and attention patterns are dropped down to 30.
- One can only have 3 jobs in flight per account at a time.
- Steering pairs (your seed pair plus generated ones) are capped at 100, which is roughly where difference-in-means vectors stabilize across resamples. Generation length is capped at 500 tokens.
- Models over 100B parameters are rejected.

If one of these caps is blocking something real you are trying to do, feel free to reach out! Some might be working constraints that can be adjusted, while others are necessary if arbitrary to keep things financially sustainable.
