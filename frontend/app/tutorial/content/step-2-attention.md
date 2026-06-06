---
index: 2
label: Attention Patterns
part: "Part 1 · IOI Circuit"
cardType: attention-pattern
configType: attention
heading: Attention Patterns
links:
  - label: "Olsson et al. 2022 — In-context learning and induction heads"
    url: "https://arxiv.org/abs/2209.11895"
  - label: "Jain & Wallace 2019 — Attention is not Explanation"
    url: "https://arxiv.org/abs/1902.10186"
  - label: "Sharkey et al. 2025 — Open Problems in Mechanistic Interpretability"
    url: "https://arxiv.org/abs/2501.16496"
---

An attention head computes a weighted average of value vectors, with weights from a softmax over query-key dot products. The attention pattern shows those weights as a square matrix per head: rows are query positions (which token is attending), columns are key positions (what it attends to). Each row sums to one. The upper-right triangle is always zero; autoregressive masking prevents attending to future positions. The BOS token (leftmost column) often accumulates weight across many heads regardless of the task. GPT-2 uses it as an attention sink: when a head has no useful target, it parks weight on BOS rather than distributing small values across irrelevant tokens.

![Figure 2 from Wang et al. 2022 showing attention head roles in the IOI circuit](/figure2_wang.png)

The card shows all twelve heads for the selected layer. The IOI circuit contains several identifiable head classes worth navigating to directly. Try clicking on cells or head numbers to pin any interesting logits or heads you find interesting as you read further.

The Name Movers (9.6, 9.9, 10.0) are a good entry point here. At layer 9, heads H6 and H9 show a single high-weight cell in the bottom row at the column for " Mary". Layer 10 head H0 shows the same. The bottom row corresponds to the final token (" to"), so these heads are copying " Mary" into the output position. The Negative Name Movers (10.7, 11.10) mirror this pattern but attend to " John", a hedging mechanism that reduces overconfidence. The S-Inhibition heads (7.3, 7.9, 8.6, 8.10) also have an active bottom row, but the bright column is the second " John"; they flag the subject so the Name Movers do not promote it. The Duplicate Token heads (0.1, 3.0) look different: find the row for the second " John" in layers 0 and 3, and it attends back to the first " John", the repetition-detection signal that starts the causal chain. The Previous Token heads (2.2, 4.11) produce a near-diagonal pattern where nearly every token attends one position to its left. The Induction heads (5.5, 6.9) extend this: at the row for the second " John", they attend to the position immediately after the first " John", where Previous Token heads wrote that token's identity.

## Caveat

Attention patterns and head effects on the residual stream are largely independent. Each head has two separate computations: the QK side (query-key dot products) determines the attention weights you see in the heatmap, and the OV side (output projection of the weighted values) determines what actually gets written to the residual stream. These are mostly independent, so two heads with identical attention patterns can write entirely different things downstream. The Backup Name Movers (9.0, 9.7, 10.1, 10.2, 10.6, 10.10, 11.2, 11.9) are examples of this: their patterns are structurally unremarkable across all eight heads, yet ablating the primary Name Movers reveals they carry significant weight. They were invisible from pattern inspection alone and were discovered only through causal intervention.


