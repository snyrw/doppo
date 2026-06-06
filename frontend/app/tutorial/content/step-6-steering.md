---
index: 6
label: Steering
part: "Part 2 · Activation Steering"
cardType: steering
configType: steering
heading: Steering
links:
  - label: "Turner et al. 2023 — Activation Addition"
    url: "https://arxiv.org/abs/2308.10248"
  - label: "Panickssery et al. 2023 — Contrastive Activation Addition (CAA)"
    url: "https://arxiv.org/abs/2312.06681"
  - label: "Zou et al. 2023 — Representation Engineering"
    url: "https://arxiv.org/abs/2310.01405"
  - label: "Arditi et al. 2024 — Refusal in Language Models Is Mediated by a Single Direction"
    url: "https://arxiv.org/abs/2406.11717"
---

The previous steps asked which components implement a behavior. This step asks whether you can shift model behavior without identifying the circuit at all.

Difference-in-means (DIM) constructs a steering vector from pairs of prompts that contrast two conditions. Here the axis is language: one set of prompts asks the model to answer in English, the other in French. Run the model on all prompts, record the residual stream activations at a fixed layer, and average separately across the two groups. The difference of those two averages is a vector that points from one behavioral region of activation space toward the other. Normalize it, then at inference time scale by a constant alpha and add it to the residual stream at that layer on every forward pass.

This step uses Qwen2.5-1.5B-Instruct rather than GPT-2 because language steering requires a multilingual model; GPT-2 is not one. The vector is computed from 40 English/French question pairs, added at layer 14, and tested on generation prompts unrelated to the training pairs.

Across our three prompts, there are some fairly interesting outputs. We can see that two prompts respond in French when steering by alpha = 20, but one seems to give us Italian. This might suggest that at least for Qwen-2.5-1.5B-Instruct that this steering direction captures more than just a "French" direction.

## Caveat

The extracted direction may not isolate the concept you intended. DIM works most reliably when pairs cleanly vary along a single axis, the concept is well-represented in the model's activation space, and enough pairs are used (Panickssery et al. used 100+). As addressed above, the language example here shows that even a clean setup can produce a broader direction than expected. Steering also degrades factual accuracy (though the baseline output isn't particularly accurate either; see Mariners' 1970 and 2051 World Series win in the steered/non-steered outputs for card #3), which is more pronounced in smaller models.
