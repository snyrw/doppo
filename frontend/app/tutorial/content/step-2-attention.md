---
index: 2
label: Attention Patterns
part: "Part 1 · IOI Circuit"
cardType: attention-pattern
configType: attention
heading: Attention Patterns
links:
  - label: "Olsson et al. 2022, In-context learning and induction heads"
    url: "https://arxiv.org/abs/2209.11895"
  - label: "Jain & Wallace 2019, Attention is not Explanation"
    url: "https://arxiv.org/abs/1902.10186"
---

An attention head decides how much each token should borrow from every other token, using a softmax over query-key dot products to turn those scores into a weighted average of value vectors. The heatmap shows those weights for one head: rows are query positions, columns are key positions, and each row sums to one. The upper-right triangle is always empty, since autoregressive masking stops a token from attending to anything that comes after it. The leftmost column, the BOS token, often lights up across many heads. That's an example of an attention sink, which is a place a head can park its weight when it has nothing useful to attend to.

The card shows all twelve heads for the layer you've selected. Click a cell or a head number to pin it as you read below, since a few head types are worth finding directly.

Out of several head types identified in Wang et al., three were given more attention. Duplicate Token heads (0.1, 3.0) spot a repetition in the prompt. Find the second " John" row and watch it attend back to the first " John". S-Inhibition heads (7.3, 7.9, 8.6, 8.10) pass that signal forward, attending to the same second " John" but from the final token position, marking it as the name to avoid. Name Mover heads (9.6, 9.9, 10.0) then close the loop. At that same final position as before, they attend to " Mary" instead and copy it into the output.