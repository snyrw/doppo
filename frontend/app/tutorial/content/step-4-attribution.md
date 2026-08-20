---
index: 4
label: Attribution Patching
part: "Part 1 · IOI Circuit"
cardType: attribution
configType: attribution
heading: Attribution Patching
links:
  - label: "Nanda, Attribution Patching: Activation Patching At Industrial Scale"
    url: "https://www.neelnanda.io/mechanistic-interpretability/attribution-patching"
---

Full activation patching, the card with the dark blue tooltip, needs one forward pass per component you want to test. Affordable on smaller models, but infeasible once you start scaling up even past a few billion parameters. Originally covered by Neel Nanda, attribution patching estimates the same thing in a single forward/backward pass by using the gradient as a stand-in for intervening. Essentially multiply how sensitive the output is to a component's activation (its gradient) by how much that activation actually differs between the clean and corrupted prompts. That product is a linear approximation of what real patching would have found, and it's cheap because a single backward pass computes it for every component at once.

The corrupted prompt swaps the two names: "When John and Mary went to the store, Mary gave a drink to". With the names reversed, " John" is now the grammatically correct continuation, so the gap between logit(" Mary") and logit(" John") shrinks. Components whose activations shifted the most between the clean and corrupted runs, and that also sit along the path the gradient flows through, get the highest scores. The heatmap below shows this signed score for every head at every layer.

Compare it to the DLA heatmap from the previous card. DLA only found strong scores at layers 9-10, the heads that write directly to the output. Attribution patching also lights up layers 7-8, the S-Inhibition heads, because the gradient flows through the whole computation graph instead of stopping at the final output.

It should be remembered that this is only an approximation, however, and it can break down around sharp bends in the loss landscape, like LayerNorm and softmax. On larger models or harder tasks, the ranking here can end up noisy or even wrong. The next step runs full activation patching to check these results against the real thing.
