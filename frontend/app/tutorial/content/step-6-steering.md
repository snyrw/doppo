---
index: 6
label: Steering
part: "Part 2 · Activation Steering"
cardType: steering
configType: steering
heading: Steering
links:
  - label: "Turner et al. 2023, Activation Addition"
    url: "https://arxiv.org/abs/2308.10248"
  - label: "Panickssery et al. 2023, Contrastive Activation Addition (CAA)"
    url: "https://arxiv.org/abs/2312.06681"
  - label: "Zou et al. 2023, Representation Engineering"
    url: "https://arxiv.org/abs/2310.01405"
  - label: "Arditi et al. 2024, Refusal in Language Models Is Mediated by a Single Direction"
    url: "https://arxiv.org/abs/2406.11717"
---

The previous steps asked which components implement a behavior. This step asks whether you can shift model behavior without identifying the circuit at all.

Difference-in-means (DIM) constructs a steering vector from pairs of prompts that contrast two conditions. Here the axis is language: one set of prompts asks the model to answer in English, the other in French. Run the model on all prompts, record the residual stream activations at a fixed layer, and average separately across the two groups. The difference of those two averages is a vector that points from one behavioral region of activation space toward the other. At inference time, scale it by a constant alpha (the raw mean difference is used unnormalized, as in Arditi et al.'s activation addition) and add it to the residual stream at that layer on every forward pass.

This step uses Llama 3.1 (8B) Instruct rather than GPT-2 because language steering requires a multilingual model; GPT-2 is not one. The vector is computed from 100 English/French question pairs, added at layer 16, and tested on generation prompts unrelated to the training pairs.

Across our three prompts, alpha is set to 1, Arditi et al.'s reference coefficient (one full unit of the raw mean-difference vector, no extra tuning on top). Unlike some other multilingual models we tried this setup on, Llama 3.1 8B lands cleanly on French every time: the recipe prompt, the Doppo Kunikida prompt, and the Mariners prompt are all answered in French, with the baseline English answer shifted wholesale into the target language rather than drifting into a third one.

## Caveat

The extracted direction may not isolate the concept you intended, and even when it does, injecting it at every position is not free. DIM works most reliably when pairs cleanly vary along a single axis, the concept is well-represented in the model's activation space, and enough pairs are used (Panickssery et al. used 100+). Here the direction reliably isolates "answer in French," but the injection still perturbs content: on the Doppo Kunikida prompt, the baseline correctly reports he died in 1908 and was a novelist, while the steered French answer calls him a manga author and invents a death date of March 9, 1934 — matching, oddly, the same day of the month as its (also fabricated) birth date. The language shift is clean; the facts riding along with it are not guaranteed to survive.
