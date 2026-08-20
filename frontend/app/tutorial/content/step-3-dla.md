---
index: 3
label: Direct Logit Attribution
part: "Part 1 · IOI Circuit"
cardType: dla
configType: dla
heading: Direct Logit Attribution
links:
  - label: "Elhage et al. 2021, A Mathematical Framework for Transformer Circuits"
    url: "https://transformer-circuits.pub/2021/framework/index.html"
---

Every attention head and MLP layer writes a vector into the residual stream, and since the unembedding matrix W_U is linear, you can push any single component's write through it on its own. That gives you the component's direct contribution to a token's logit, without needing to know anything else about what the model wrote. Direct logit attribution (DLA) does this for every component, producing a score for logit(" Mary") minus logit(" John") on the clean prompt.

The head chart shows that score for all 144 attention heads in GPT-2 Small. Most sit at zero, but the Name Mover heads (9.6, 9.9, 10.0) each contribute roughly +0.5 to +1.5 logit units toward " Mary", and Negative Name Movers (10.7, 11.10) contribute -0.5 to -1.0, pushing for " John" instead. Just a few heads can do a lot of work in certain prompts.

It should be said that DLA only sees direct contributions to the output, so a head can be doing work behind the scenes earlier in the circuit and still score near zero here if its effect passes through other components before reaching the output. The S-Inhibition heads (layers 7-8) are a clear example, as they are quite important to the IOI circuit, but somehow barely visible to DLA. Attribution patching, the card with the cyan tooltip and the one you should focus on next, is what surfaces effects like theirs.
