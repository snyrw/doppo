---
index: 3
label: Direct Logit Attribution
part: "Part 1 · IOI Circuit"
cardType: dla
configType: dla
heading: Direct Logit Attribution
links:
  - label: "Elhage et al. 2021 — A Mathematical Framework for Transformer Circuits"
    url: "https://transformer-circuits.pub/2021/framework/index.html"
  - label: "2023 — An Adversarial Example for Direct Logit Attribution"
    url: "https://arxiv.org/abs/2310.07325"
---

Because the residual stream is additive and the unembedding W_U is linear, each component's contribution to the final logit can be isolated. Every attention head and MLP layer writes a vector into the residual stream; because W_U is a linear projection, you can pass each component's write through W_U independently and read off its direct contribution to any token's logit. Direct logit attribution (DLA) does this for every component, producing a signed score for logit(" Mary") minus logit(" John") on the clean prompt.

The bar chart shows all 144 attention heads in GPT-2 Small. Most are near zero. The Name Mover heads (9.6, 9.9, 10.0) each contribute roughly +0.5 to +1.5 logit units; the Negative Name Movers (10.7, 11.10) contribute -0.5 to -1.0.

## What to Notice

Roughly five of 144 heads account for almost all of the logit difference. This sparsity is a consistent property of circuits: a behavior tends to be implemented by a small subgraph, not spread evenly across the network.

## Caveat

DLA measures only direct contributions to the output logit. A head that acts earlier in the circuit can be causally necessary without projecting strongly onto the output direction. The S-Inhibition heads (layers 7-8) are the clear case here: near-zero DLA, but central to the circuit. Attribution patching in the next step captures those indirect effects.
