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
variants:
  "5": "This card steers the recipe prompt. It lands cleanly on French with nothing factual at stake, since a recipe suggestion doesn't have a right answer to get wrong."
  "5b": "This card steers the Doppo Kunikida biography prompt. The language lands on French, but the facts don't: it calls him a manga author and invents a death date that matches the day of his own fabricated birth date."
  "5c": "This card steers the Mariners trivia prompt. Both the language and the answer land correctly here, unlike the Kunikida card alongside it."
---

These three cards show something different from the others around them, as they have nothing to do with IOI. They demonstrate difference-in-means steering, a technique for pushing a model's behavior in a chosen direction.

Difference-in-means builds a steering vector from prompt pairs that contrast two conditions. We've chosen English versus French for a simple binary here. The idea is that you'd want to run the model on both sets, average the residual stream activation at a fixed layer within each group, and subtract. You end up with a resulting vector pointing from "answers in English" toward "answers in French", for this example. At inference time, scale it by a constant "alpha" and add it to the residual stream at that layer on every forward pass.

This step uses Llama 3.1 (8B) Instruct instead of GPT-2, since language steering becomes more coherent on both a larger and multilingual model. The vector is built from 100 English/French prompt pairs at layer 16, and applied here to three unrelated prompts at alpha 1, which is Arditi et al.'s reference coefficient. Slight tangent, but Llama represents somewhat of a clean example compared to Qwen (also tried), which ends up steering into non-French languages fairly often.