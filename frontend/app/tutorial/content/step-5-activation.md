---
index: 5
label: Activation Patching
part: "Part 1 · IOI Circuit"
cardType: activation
configType: activation
heading: Activation Patching
links:
  - label: "Tigges et al. 2024 — IOI circuit consistent across training and scale"
    url: "https://arxiv.org/abs/2407.10827"
  - label: "Meng et al. 2022 — Locating and Editing Factual Associations in GPT (ROME)"
    url: "https://arxiv.org/abs/2202.05262"
  - label: "Zhang & Nanda 2024 — Towards Best Practices of Activation Patching"
    url: "https://openreview.net/forum?id=Hf17y6u9BC"
  - label: "Goldowsky-Dill et al. 2023 — Localizing Model Behavior with Path Patching"
    url: "https://arxiv.org/abs/2304.05969"
  - label: "Heimersheim & Nanda 2024 — How to use and interpret activation patching"
    url: "https://arxiv.org/abs/2404.15255"
---

Activation patching is a direct causal intervention. Cache activations from a clean run and a corrupted run. Then for each component, run the clean prompt again with that component's activation replaced by its corrupted-run value, and measure the change in logit(" Mary") minus logit(" John"). A large drop means the component was carrying information that the corrupted run lacks; it is a node in the circuit.

There is no approximation here. Wang et al. used this procedure to identify the 26 heads that account for over 90% of the total clean-corrupted logit gap. Patching head 9.9 alone drops the logit difference by roughly 1.5-2 units.

## What to Notice

Compare this heatmap to attribution patching from the previous step. The same heads dominate both, which confirms that the gradient approximation held on this task. Look at the layer distribution: layers 7-10 show effects; layers 0-6 are nearly silent. That range is the causal extent of the IOI circuit.
