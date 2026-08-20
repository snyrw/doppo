---
index: 1
label: Logit Lens
part: "Part 1 · IOI Circuit"
cardType: logit-lens
configType: lens
heading: Logit Lens
links:
  - label: "nostalgebraist 2020, interpreting GPT: the logit lens"
    url: "https://www.lesswrong.com/posts/AcKRB8wDpdaN6v6ru/interpreting-gpt-the-logit-lens"
---

Transformer layers read and write to the additive result of all layers before it, which is known as the residual stream. To eventually get words from a transformer, we apply an unembedding matrix W_U at the final layer that then turns this residual stream into vocabulary logits.

In 2020, nostalgebraist introduced the logit lens, which applies W_U after each layer instead of just at the end. This results in the ability to see output change across each layer, and this is often rendered as a heatmap. There are several different modes that you can look at with this heatmap that tell you different things, such as basic token probability, top-k tokens and their probabilities, and so on.

The prompt loaded here, "When Mary and John went to the store, John gave a drink to", comes from IOI (indirect object identification), a task Wang et al. (2022) used to reverse-engineer a full circuit in GPT-2 Small. The model has to complete the sentence with the name that appears once, " Mary", rather than " John", which appears twice. It's a simple, well-understood task from a canonical paper in interpretability, which is why we use it for most of the cards here.

Focus on the rightmost column (the final token position, " to"), and find the layer where " Mary" first appears at high probability. The transition typically occurs around the mid-to-late layers. This ties into the attention head analysis card below, where you'll look at various heads that are proposed to have caused the transition.