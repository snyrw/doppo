---
title: Techniques
---

So far, we have 6 techniques that can be used on Doppo. Here are a few notes as to how you should interpret these:
- This mostly acts as a reference to show what we've done and where we've diverged in technical detail from baseline
- The purpose for that was to add a quick verification on what exactly you were spending your time on rather than just guessing or reading through the code base
- That means that this might be overly wordy or dense, probably not the best for learning currently (though the tutorial handles this somewhat well)
- Changes have been considered to boil things down a bit more with simple sections that cover nuance being in the works, and it's suggested that you should reference the canonical sources discussed if curious

## Logit lens

Follows nostalgebraist's logit lens (2020). The residual stream entering each block (plus the final residual) is passed through the model's own final layer norm and unembedding matrix, giving the next-token distribution the model would produce if the remaining layers were skipped. Reusing the trained final layer norm, rather than projecting the raw residual, which matches the original post.

The default heatmap colors each cell by the probability that layer assigns to the token that actually comes next in the prompt, and each cell lists the layer's top-5 predicted tokens. Alternate views in the card header: per-layer KL divergence from the final layer's distribution, the rank each layer assigns to the final layer's top-1 token, and the entropy of each layer's distribution.

## Attention patterns

The post-softmax attention weights for every head in every layer, read directly from the model's attention hooks. This is the same matrix displayed by standard attention visualizers such as BertViz (Vig, 2019) and CircuitsVis.

Prompts are truncated to their first 30 tokens. Pattern size grows quadratically with sequence length, and cards become too large/laggy past that point.

## Direct logit attribution

Decomposes a single logit into additive contributions from each component, following Elhage et al., "A Mathematical Framework for Transformer Circuits" (2021). For a chosen target token at a chosen position, each component's output is dotted with the target's unembedding direction: per attention head (the head's post-W_O output, computed as z multiplied by W_O), per layer (attention and MLP outputs, separately and summed), plus the embedding's contribution (the residual stream entering block 0). Supplying a contrastive token switches the direction to the difference of the two unembedding columns, attributing a logit difference instead.

For final layer norm handling, the LN weights and the norm scale are folded into the logit direction, with the scale frozen at its actual value on the final residual at the target position. For models whose final norm has a bias, the bias's contribution to the logit is reported as a separate position-independent constant rather than being attributed to any component.

## Attribution patching

A gradient-based approximation to activation patching, following Nanda's attribution patching (2023) and Syed et al.'s edge attribution patching (2023). Given a clean and a corrupted prompt (which must tokenize to the same length), one forward pass caches clean activations, and one forward and backward pass on the corrupted prompt collects activations and gradients of the metric. Each component is scored as (clean activation minus corrupted activation) dotted with the corrupted-run gradient, at the target position. This is a first-order Taylor estimate of the effect of patching the clean activation into the corrupted run (the denoising direction).

The metric is the target token's logit, or the target minus contrastive logit difference when a contrastive token is given. The components we score consists of each attention head's z output and each layer's MLP output. The top 30 components by absolute score are returned.

The estimate is a linearization and is known to be unreliable for components whose activations change a lot between the two runs. We use it because true attribution at this scale is largely unaffordable due to the number of forward passes that would be required. The activation patching card that spins off of this exists to check top components with real patches.

## Activation patching

Causal patching in the denoising direction (Vig et al., 2020; Meng et al.'s causal tracing, 2022; see Heimersheim and Nanda, 2024 for conventions): run the corrupted prompt while splicing in the clean run's activation for one component at a time, and measure how much of the clean behavior returns. Clean and corrupted prompts must tokenize to the same length.

Each component costs one forward pass, so this runs on the top-k components carried over from an attribution card rather than on every component. Patches are applied at the target position only, at the same granularity as attribution: a single head's z output or a layer's MLP output. The reported effect is normalized recovery, (patched metric minus corrupted metric) divided by (clean metric minus corrupted metric): 0 means the patch changed nothing, 1 means that single component fully restored the clean behavior.

## Steering

Difference-in-means activation addition, following Arditi et al., "Refusal in Language Models Is Mediated by a Single Direction" (2024). Earlier work (Turner et al.'s ActAdd, 2023; Rimsky et al.'s CAA, 2023) established adding a fixed vector to the residual stream; Arditi et al.'s formulation of the vector and injection is the one implemented here.

The vector is the mean, over all contrast pairs, of the residual stream entering block L at the clean prompt's last token minus the same read at the corrupted prompt's last token. Each prompt is read at its own last token, so pairs need not tokenize to the same length. When the model has a chat template it is applied before extraction, landing the read on the final post-instruction template token. The vector is not unit-normalized. Alpha times the vector is added at the same hook at every position, during both the prompt pass and each generated token, so alpha = 1 adds exactly one unit of the concept's mean displacement where it was measured.

Departures from the paper, so results can be compared: the source layer is chosen by the user rather than by the paper's validated sweep, since there is no task metric for an arbitrary concept, and the vector comes from paired free-form prompts rather than two unpaired instruction sets (for equal-size sets the mean of differences equals the difference of group means, so the construction is the same). Directional ablation, the paper's second intervention, is not implemented.

Reliability caveats from the literature apply directly. Vectors built from a handful of pairs are unstable across resamples and stabilize around 100 pairs, which is where we've capped it for the sake of straddling between the border of usability and affordability.

Generation applies the model's chat template when one exists. Sampling uses temperature with a repetition penalty on already-generated tokens (HF convention); a temperature of 0 or below gives greedy decoding.
