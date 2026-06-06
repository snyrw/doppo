---
index: 4
label: Attribution Patching
part: "Part 1 · IOI Circuit"
cardType: attribution
configType: attribution
heading: Attribution Patching
links:
  - label: "Nanda — Attribution Patching: Activation Patching At Industrial Scale"
    url: "https://www.neelnanda.io/mechanistic-interpretability/attribution-patching"
  - label: "Kramár et al. 2024 — AtP*: An efficient and scalable method for localizing LLM behaviour"
    url: "https://arxiv.org/abs/2403.00745"
  - label: "Rezaei Jafari et al. 2025 — RelP: Faithful and Efficient Circuit Discovery via Relevance Patching"
    url: "https://arxiv.org/abs/2508.21258"
---

Full activation patching (the next step) requires one forward pass per component: 144 for GPT-2 Small, tens of thousands for a large model. Attribution patching approximates this in a single forward-and-backward pass by using gradients as a proxy for interventions. The intuition: if you want to know how much replacing a component's activation would change the output, you can estimate it by multiplying (a) how sensitive the output is to that activation (the gradient of the logit difference) by (b) how much the activation actually changes between clean and corrupted runs. This dot product is a first-order Taylor approximation of the true patching effect.

The corrupted prompt swaps the names: "When John and Mary went to the store, Mary gave a drink to". With names reversed, " John" becomes the grammatically correct continuation, so the logit difference logit(" Mary") minus logit(" John") shrinks. Components whose activations differ between runs and lie on the gradient path receive high attribution scores. The signed heatmap shows each head's score across all layers.

## What to Notice

Compare the heatmap to the DLA results from the previous step. DLA found significant scores only at layers 9-10. Attribution patching also surfaces layers 7-8 (the S-Inhibition heads), because it propagates gradient through the full computation graph rather than projecting at the output only. The indirect part of the causal chain becomes visible.

## Caveat

First-order approximations can fail where the loss landscape curves sharply, such as around LayerNorm and softmax. On larger models or more complex tasks, attribution scores can be noisy enough that the ranking does not match full patching results. The next step runs actual activation patching to verify these findings on this task.
