---
index: 5
label: Activation Patching
part: "Part 1 · IOI Circuit"
cardType: activation
configType: activation
heading: Activation Patching
links:
  - label: "Zhang & Nanda 2024, Towards Best Practices of Activation Patching"
    url: "https://openreview.net/forum?id=Hf17y6u9BC"
  - label: "Heimersheim & Nanda 2024, How to use and interpret activation patching"
    url: "https://arxiv.org/abs/2404.15255"
---

As discussed in the attribution card (cyan tooltip), activation patching is a direct causal intervention rather than an estimate. Cache activations from a clean run and a corrupted run, then for each component, run the clean prompt again but swap in that one component's activation from the corrupted run. Measure how much logit(" Mary") minus logit(" John") drops. A large drop means that component was carrying information the corrupted run doesn't have.

The difference from attribution patching is that it estimated this effect with a single gradient pass, but we end up testing all components here. Wang et al. used this procedure to identify the 26 heads that account for over 90% of the total clean-corrupted logit gap. Taking a look at head 9.9, patching it alone drops the logit difference by a large amount.

Compare this barchart/heatmap to the attribution patching one from the previous card. The same heads are important in both, which means that the gradient approximation holds up nicely here. Zooming into layers, 7 to 10 show effects, while layers 0 to 6 stay nearly silent. That range is the causal extent of the IOI circuit.
