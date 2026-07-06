---
title: Techniques
---

We currently have six techniques that users can work with.

To interject a bit before we describe things, it should be said that we took minimal liberties with what's been implemented so far. Almost everything is at least somewhat subject to change given the nature of how fast interpretability moves, and to put the cart ahead of the horse a bit, updates to whatever we host will be may potentially be added over time. 

## Logit lens

Following nostalgebraist's original logit lens (2020), our implementation projects the residual stream at every layer through the model's final layer norm and unembedding, showing what the model would predict if it stopped at that depth. We've included the choice to reuse the model's own final layer norm (what?).

We use a common heatmap format that colors each cell by the probability any layer assigns to the token that comes next. Some alternate views of that can be accessed in the card header include per-layer KL divergence from the final layer's distribution, the rank the layer gives the final layer's top-1 token, and the entropy of the layer's distribution.

## Direct logit attribution

We decompose a single logit into additive contributions from each component, following the direct logit attribution method of Elhage et al., "A Mathematical Framework for Transformer Circuits" (2021). For a chosen target token at a chosen position, we dot each component's output with the target's unembedding direction: per attention head (the head's post-W_O output), per layer (attention and MLP outputs, separately and summed), plus the embedding's contribution.

## Attribution patching

A fast, approximate version of activation patching, following Neel Nanda's attribution patching (2023) and Syed et al.'s edge attribution patching (2023). You give a clean prompt and a corrupted prompt, and we run the corrupted prompt with gradients on with score each component by (clean activation minus corrupted activation) dotted with the gradient of the metric at the corrupted run. That is a first-order Taylor estimate of what actually patching the clean activation in would do.

The estimate is known to be unreliable for components with large activation changes (it is a linearization), which is why we include some (if fairly limited) activation patching for top components found in attribution cards.

## Activation patching

Follows the causal mediation methodology of Vig et al. (2020) and Meng et al.'s causal tracing (2022), in the denoising direction used in the IOI work of Wang et al. (2022): run the corrupted prompt, but splice in the clean run's activation for one component at a time, and see how much of the clean behavior comes back.

Each component gets its own forward pass, so alluded to before, this only runs on the top-k components from an attribution card rather than everything. We patch only at the target position. The reported effect is normalized recovery: (patched metric minus corrupted metric) divided by (clean metric minus corrupted metric). 0 means the patch did nothing, 1 means that single component restored the clean behavior entirely.

## Steering

Builds a steering vector from contrast pairs and adds it during generation, then shows steered and baseline generations side by side. Two methods, following the papers they are named after:

- **CAA** (Rimsky et al., 2023): the vector is read from the residual stream after a block, and during generation it is added from the last prompt token onward, leaving the prompt itself unsteered.
- **ActAdd** (Turner et al., 2023): the vector is read from the residual stream before a block, and added at every position.

The vector itself is a difference in means: for each pair, the activation at the clean prompt's last token minus the activation at the corrupted prompt's last token, averaged over all pairs. Each prompt is read at its own last token; pairs do not need to tokenize to the same length. You can also read and inject at a single attention head's z output or a layer's MLP output instead of the residual stream.

Where we differ from the papers: CAA originally extracts from the answer letter of multiple-choice contrast pairs; we extract from the last token of free-form prompt pairs. ActAdd originally aligns and pads a single prompt pair token by token; we use last-token extraction there too. (completely wrong, needs a rewrite)

## Attention patterns

The post-softmax attention weights for every head in every layer, straight from the model. (actually find out where this came from)

Prompts are capped at the first 30 tokens here because cards can grow incredibly large (and laggy) once they had prompts that reach dozens or hundreds of tokens.
