---
index: 0
label: Introduction
heading: Replicating Key Works
links:
  - label: "Wang et al. 2022 — IOI circuit paper"
    url: "https://arxiv.org/abs/2211.00593"
  - label: "Turner et al. 2023 — Activation Addition"
    url: "https://arxiv.org/abs/2308.10248"
  - label: "Panickssery et al. 2023 — Contrastive Activation Addition (CAA)"
    url: "https://arxiv.org/abs/2312.06681"
  - label: "Arditi et al. 2024 — Refusal in Language Models Is Mediated by a Single Direction"
    url: "https://arxiv.org/abs/2406.11717"
---

At its core, mechanistic interpretability simply asks which components of a neural network implement a specific behavior and how. This tutorial covers two research directions that Doppo current houses: circuit analysis and activation steering. 

With Part 1, you'll work through the IOI (Indirect Object Identification) circuit in GPT-2 Small from Wang et al. 2022, an earlier canonical work in the field. The IOI task uses sentences with a predictable structure: "When Mary and John went to the store, John gave a drink to ___". The indirect object (" Mary") is grammatically unambiguous. Wang et al. traced the behavior to roughly 26 attention heads and described how they interact, making IOI the first complete circuit identified in a production language model. Tigges et al. 2024 later showed the circuit persists across training stages and model scales. Part 1 uses four tools to work through it: logit lens to see when the model commits to an answer, attention patterns to inspect what specific heads attend to, direct logit attribution to measure which components write most to the output, and activation patching to verify which components are causally necessary.

Part 2 switches to Qwen2.5-1.5B-Instruct and asks a different question. Rather than tracing how a behavior is implemented, it asks whether you can shift model behavior by directly manipulating activations. The basic idea: collect pairs of prompts that differ along one axis (say, English vs. French), run the model on each, and record the activations at a fixed layer. Average the activations across each group, subtract one from the other, and normalize. The resulting vector points from one behavioral region of activation space toward the other. Add it back at inference time and the model's behavior shifts. Turner et al. 2023 and Panickssery et al. 2023 established this method (called difference-in-means, or DIM if you really want to shorten it); subsequent work has applied it to safety-relevant behaviors in open models like ablating/inducing refusal in Arditi et al. 2024. The step here extracts a direction from English/French pairs and tests it on several unrelated prompts to see what concept the model's geometry actually captures.