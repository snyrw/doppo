---
index: 1
label: Logit Lens
part: "Part 1 · IOI Circuit"
cardType: logit-lens
configType: lens
heading: Logit Lens
links:
  - label: "nostalgebraist 2020 — interpreting GPT: the logit lens"
    url: "https://www.lesswrong.com/posts/AcKRB8wDpdaN6v6ru/interpreting-gpt-the-logit-lens"
  - label: "Belrose et al. 2023 — Eliciting Latent Predictions from Transformers with the Tuned Lens"
    url: "https://arxiv.org/abs/2303.08112"
---

Each transformer layer reads from and writes to a shared "residual stream", which is to say that the final state of a transformer is the additive result of all attention and MLP computations. The final layer's state is projected through the unembedding matrix W_U (the linear map from residual stream to vocabulary logits) to produce the model's output distribution. In 2020, nostalgebraist introduced the logit lens, which applies W_U at each intermediate layer as well and treats the residual stream at that depth as if the forward pass had already ended. The result is a heatmap where each cell shows the top predicted token at a given layer and token position.

The prompt is the IOI sentence from Wang et al.: "When Mary and John went to the store, John gave a drink to". The correct next token is " Mary". Five metrics are available: next-token probability (how likely the top token is), top-1 probability (the probability the model assigns to the correct continuation), KL divergence from the final layer's distribution (how far the implicit prediction at this depth is from what the full model produces), rank (where the correct token falls in the sorted vocabulary), and entropy (how spread out or concentrated the probability mass is). Together they show different aspects of when and how decisively the model commits to a prediction at each depth.

## What to Notice

Focus on the rightmost column (the final token position, " to"). Find the layer where " Mary" first appears at high probability. The transition typically occurs around the mid-to-late layers. That is where the specific attention heads (Name Mover and S-Inhibition) fire; the following step will examine those components directly.
