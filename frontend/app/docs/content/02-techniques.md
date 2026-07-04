---
title: Techniques
---

Six techniques are available. For each one, this section says what it computes, which work it follows, where our implementation differs, and what you can set. Everything runs through TransformerLens hooks on the real model.

## Logit lens

Projects the residual stream at every layer through the model's final layer norm and unembedding, showing what the model would predict if it stopped at that depth. Follows nostalgebraist's original logit lens (2020), including the choice to reuse the model's own final layer norm.

The heatmap colors each cell by the probability that layer assigns to the token that actually comes next. Cells also carry the layer's top-k candidate tokens. Alternate views: per-layer KL divergence from the final layer's distribution, the rank the layer gives the final layer's top-1 token, and the entropy of the layer's distribution.

You set the prompt and the model. Positions come from the prompt's own tokens; nothing is averaged.

## Direct logit attribution

Decomposes a single logit into additive contributions from each component, following the direct logit attribution method of Elhage et al., "A Mathematical Framework for Transformer Circuits" (2021). For a chosen target token at a chosen position, we dot each component's output with the target's unembedding direction: per attention head (the head's post-W_O output), per layer (attention and MLP outputs, separately and summed), plus the embedding's contribution.

Two approximations, both standard: the final layer norm is folded into the logit direction using the scale from the actual final residual (frozen, not differentiated), and components are mean-centered per component. The layer norm bias term is reported separately rather than smeared across components.

You set the prompt, the position, the target token (default: whatever the model actually predicts there), and optionally a contrastive token, which turns the metric into a logit difference. Logit differences are usually the better-behaved choice, same as in the circuits literature.

## Attribution patching

A fast, approximate version of activation patching, following Neel Nanda's attribution patching (2023) and Syed et al.'s edge attribution patching (2023). You give a clean prompt and a corrupted prompt. We run the corrupted prompt with gradients on, and score each component by (clean activation minus corrupted activation) dotted with the gradient of the metric at the corrupted run. That is a first-order Taylor estimate of what actually patching the clean activation in would do.

Scope: attention heads (their z output, before W_O) and per-layer MLP outputs, at your target position. The metric is the target token's logit, or a logit difference if you set a contrastive token. Both prompts must tokenize to the same length, since one position index has to mean the same thing in both runs.

The estimate is known to be unreliable for components with large activation changes (it is a linearization). That is why the card has a verify button: it hands the top components to real activation patching.

## Activation patching

The exact version. Follows the causal mediation methodology of Vig et al. (2020) and Meng et al.'s causal tracing (2022), in the denoising direction used in the IOI work of Wang et al. (2022): run the corrupted prompt, but splice in the clean run's activation for one component at a time, and see how much of the clean behavior comes back.

Each component gets its own forward pass, so this runs on the top-k components from an attribution card rather than everything. We patch only at the target position, not the full sequence. The reported effect is normalized recovery: (patched metric minus corrupted metric) divided by (clean metric minus corrupted metric). 0 means the patch did nothing, 1 means that single component restored the clean behavior entirely.

## Steering

Builds a steering vector from contrast pairs and adds it during generation, then shows steered and baseline generations side by side. Two methods, following the papers they are named after:

- **CAA** (Rimsky et al., 2023): the vector is read from the residual stream after a block, and during generation it is added from the last prompt token onward, leaving the prompt itself unsteered.
- **ActAdd** (Turner et al., 2023): the vector is read from the residual stream before a block, and added at every position.

The vector itself is a difference in means: for each pair, the activation at the clean prompt's last token minus the activation at the corrupted prompt's last token, averaged over all pairs. Each prompt is read at its own last token; pairs do not need to tokenize to the same length. You can also read and inject at a single attention head's z output or a layer's MLP output instead of the residual stream.

Where we differ from the papers: CAA originally extracts from the answer letter of multiple-choice contrast pairs; we extract from the last token of free-form prompt pairs. ActAdd originally aligns and pads a single prompt pair token by token; we use last-token extraction there too. And we do not normalize the vector, so the useful range of the strength setting depends on the model's activation norms. Expect to experiment: on some models a strength of 3 does something, on others you need 20.

You set the pairs (write one, and optionally have more generated for you, up to a per-tier cap), the layer and injection site, the strength (alpha), a separate generation prompt if you want one, and sampling settings (token count, temperature, repetition penalty). Chat-tuned models get their chat template applied automatically so generation stays in distribution.

## Attention patterns

The post-softmax attention weights for every head in every layer, straight from the model. This is standard attention visualization, not a technique with a citation fight behind it. Useful for spotting induction heads, previous-token heads, and the like.

Prompts are capped at the first 30 tokens here, because the pattern data grows quadratically and the visualization stops being readable past that anyway.
