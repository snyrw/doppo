export type TutorialLink = {
  label: string;
  url: string;
};

export type TutorialStep = {
  index: number;
  label: string;
  cardType: "logit-lens" | "attention-pattern" | "dla" | "attribution" | "activation" | "steering";
  configType: "lens" | "attention" | "dla" | "attribution" | "activation" | "steering";
  heading: string;
  paragraphs: string[];
  whatToNotice: string;
  caveat?: string;
  links: TutorialLink[];
};

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    index: 0,
    label: "Logit Lens",
    cardType: "logit-lens",
    configType: "lens",
    heading: "Logit Lens",
    paragraphs: [
      "Transformers build up a prediction by passing a \"residual stream\" through a sequence of attention and MLP layers. Each layer reads from and writes to this shared stream. The final layer's output is projected through the unembedding matrix W_U to produce logits over the vocabulary.",
      "The logit lens applies that same projection at every intermediate layer, not just the last one. This lets you watch the model's implicit prediction evolve as it processes the input — a layer-by-layer film of the model committing to an answer.",
      "The heatmap shows, for each token position and each layer, the probability of the most-likely next token under the raw logit lens. Bright cells at a position mean the model already has a confident prediction at that layer; dark cells mean it doesn't yet.",
      "We're running this on the IOI (Indirect Object Identification) task from Wang et al. 2022 — a canonical benchmark in mechanistic interpretability. The prompt \"When Mary and John went to the store, John gave a drink to\" has a single correct continuation: \" Mary\" (the indirect object). What's striking is how late the model commits to this answer — only in the final three layers does \" Mary\" rise to the top.",
    ],
    whatToNotice: "Look at the final token position (the last column). Notice which layer is the first where \" Mary\" appears at high probability. This phase transition at layers 7–9 is the signature of the S-Inhibition and Name Mover heads firing.",
    links: [
      { label: "Wang et al. 2022 — IOI circuit paper", url: "https://arxiv.org/abs/2211.00593" },
      { label: "LogitLens4LLMs (2025) — extending to modern architectures", url: "https://arxiv.org/abs/2503.11667" },
      { label: "Tuned Lens — learned affine correction for rotated-basis models", url: "https://arxiv.org/pdf/2303.08112" },
    ],
  },
  {
    index: 1,
    label: "Attention Patterns",
    cardType: "attention-pattern",
    configType: "attention",
    heading: "Attention Patterns",
    paragraphs: [
      "Attention heads compute a weighted average of value vectors, where the weights come from a softmax over query-key dot products. The attention pattern — the matrix of weights — tells you what each head \"looks at\" when computing its output for a given position.",
      "Visualizing attention patterns across all heads reveals functional specialization: different heads in the same model learn to implement qualitatively different algorithms. The IOI circuit identified three distinct head classes whose patterns are visible here.",
      "Duplicate Token heads (layers 0–3) attend from the second occurrence of \"John\" back to the first, flagging the repeated name. S-Inhibition heads (layers 7–8, especially 7.3, 7.9, 8.6, 8.10) attend from the final token back to those duplicate positions and write a suppression signal that prevents the Name Movers from copying the wrong name. Name Mover heads (layers 9–10, especially 9.9, 9.6, 10.0) attend from the final token directly to \"Mary\" and copy it to the output.",
      "Each of these head classes has a visually distinctive pattern shape. The Duplicate Token heads show a backward diagonal at the S2 position. The Name Movers show a sharp spike on the IO token (\"Mary\") from the END position.",
    ],
    whatToNotice: "Navigate to layer 9 and look at head 9.9. Its attention from the END position focuses almost entirely on \" Mary\". That single head is doing a substantial share of the work of producing the correct answer.",
    links: [
      { label: "Wang et al. 2022 — IOI circuit paper", url: "https://arxiv.org/abs/2211.00593" },
      { label: "Olsson et al. 2022 — In-context learning and induction heads", url: "https://arxiv.org/abs/2209.11895" },
    ],
  },
  {
    index: 2,
    label: "Direct Logit Attribution",
    cardType: "dla",
    configType: "dla",
    heading: "Direct Logit Attribution",
    paragraphs: [
      "The residual stream is additive: every attention head and MLP layer writes a vector into it, and these vectors sum linearly to form the final representation. Because the unembedding matrix W_U is also linear, each component's contribution can be projected directly onto the logit direction for any token — giving a signed scalar per component.",
      "Direct Logit Attribution (DLA) applies this decomposition to compute how much each attention head and each MLP layer directly contributes to logit(\" Mary\") − logit(\" John\"), the metric that captures whether the model prefers the correct answer.",
      "The bar chart shows all 144 attention heads in GPT-2 Small. Most are essentially zero. A handful tower above the baseline: the Name Mover heads (9.6, 9.9, 10.0) each contribute +0.5 to +1.5 logit units in favor of \" Mary\". The Negative Name Movers (10.7, 11.10) contribute −0.5 to −1.0 — a hedging mechanism that reduces overconfidence.",
      "DLA is the fastest first-pass screening tool for identifying which components matter. But it has a critical limitation: it measures only direct effects. A head can be causally necessary for the correct answer without having high DLA, if it acts earlier in the circuit (e.g. S-Inhibition heads set up the Name Movers but don't write directly to the output direction).",
    ],
    whatToNotice: "Notice how few bars have significant magnitude — roughly 5 of 144 heads account for almost all of the logit difference. This sparsity is a signature of circuits: the behavior is implemented by a small, identifiable subgraph.",
    caveat: "DLA only measures direct contributions to the final logit. Heads like the S-Inhibition heads (layers 7–8) are causally necessary for the correct answer but have near-zero DLA because they act indirectly. Always follow up with activation patching to find the full causal picture.",
    links: [
      { label: "Wang et al. 2022 — IOI circuit paper", url: "https://arxiv.org/abs/2211.00593" },
    ],
  },
  {
    index: 3,
    label: "Attribution Patching",
    cardType: "attribution",
    configType: "attribution",
    heading: "Attribution Patching",
    paragraphs: [
      "Activation patching (the next step) is the gold standard for causal circuit analysis, but it requires one forward pass per component — O(n_layers × n_heads) total. For GPT-2 Small that's 144 passes; for a 70B model it would be tens of thousands.",
      "Attribution patching approximates this by using gradients instead of interventions. It computes, for each component, the dot product of the gradient of the logit difference (evaluated at a midpoint between clean and corrupted inputs) with the activation difference between clean and corrupted runs. This is a first-order Taylor approximation of the actual patching effect, and it runs in a single forward+backward pass.",
      "The signed heatmap (layer × head) shows the attribution score for each component. Positive scores mean the component is helping produce \" Mary\"; negative scores mean it's hurting. High-magnitude heads are the candidates for the causal circuit.",
      "On this task, attribution patching reliably identifies the same set of heads as full activation patching — the Name Movers at layers 9–10 score highest, and the S-Inhibition heads at layers 7–8 also show up with significant magnitude. The cheap approximation is accurate here because the clean–corrupted distance is small and the network is relatively shallow.",
    ],
    whatToNotice: "Compare the attribution heatmap to the DLA results from the previous step. DLA found high magnitude only at layers 9–10. Attribution patching also highlights layers 7–8 (S-Inhibition heads). This is because attribution patching can see indirect effects — it measures gradient flow through the full computation graph.",
    caveat: "Attribution patching is a first-order approximation. It can fail where the loss landscape is strongly curved (e.g. around LayerNorm, softmax). On larger or more complex models, the rankings can be noisy. Follow up with full activation patching on the top candidates.",
    links: [
      { label: "Nanda — Attribution Patching: Activation Patching At Industrial Scale", url: "https://www.neelnanda.io/mechanistic-interpretability/attribution-patching" },
      { label: "RelP (2025) — improved approximation via relevance propagation", url: "https://arxiv.org/html/2508.21258v1" },
    ],
  },
  {
    index: 4,
    label: "Activation Patching",
    cardType: "activation",
    configType: "activation",
    heading: "Activation Patching",
    paragraphs: [
      "Activation patching makes a causal claim: if replacing a component's activation from a clean run with the corresponding activation from a corrupted run changes the model's output, that component is doing necessary work for the behavior.",
      "The procedure: run the model on both the clean prompt (\"When Mary and John...\") and the corrupted prompt (\"When John and Mary...\") and save all activations. Then, for each component in turn, run the clean prompt again but substitute that component's activation with the value from the corrupted run. Measure the change in logit(\" Mary\") − logit(\" John\"). A large drop means the component was carrying clean-run information that the corrupted run lacks — i.e. it's a circuit node.",
      "This is the most reliable technique in the suite — no approximation, no gradients. It is the empirical foundation of the IOI circuit paper. Patching head 9.9 alone reduces the logit difference by roughly 1.5–2 units, one of the largest individual effects in the model. The complete set of 26 circuit heads accounts for over 90% of the total clean–corrupted gap.",
      "Attribution patching (the previous step) is best understood as a cheap approximation of this result. When the two methods agree — as they do on IOI — it validates both the approximation and the circuit.",
    ],
    whatToNotice: "Compare the activation patching heatmap to the attribution patching results. The same heads dominate both. Now look at which layers show effects: layers 7–10 matter, layers 0–6 are nearly silent. This is the causal boundary of the IOI circuit.",
    links: [
      { label: "Wang et al. 2022 — IOI circuit paper", url: "https://arxiv.org/abs/2211.00593" },
      { label: "Towards Best Practices of Activation Patching (OpenReview 2024)", url: "https://openreview.net/forum?id=Hf17y6u9BC" },
      { label: "Tigges et al. 2024 — IOI circuit consistent across training and scale", url: "https://arxiv.org/abs/2407.10827" },
    ],
  },
  {
    index: 5,
    label: "Steering",
    cardType: "steering",
    configType: "steering",
    heading: "Steering",
    paragraphs: [
      "The previous five steps asked a single question: how does the model implement a specific behavior? Steering asks a different question: can we control the model's behavior directly, without knowing the circuit?",
      "The approach: collect a set of contrastive prompt pairs that differ along one behavioral axis (here, language: English vs. French). Run the model on each pair and record the residual stream activations at a chosen layer. Compute the mean activation on the \"positive\" prompts (French), subtract the mean activation on the \"negative\" prompts (English), and normalize. This is the Difference-in-Means (DIM) direction.",
      "At inference time, multiply this direction by a scalar alpha and add it to the residual stream at the chosen layer on every forward pass. The injected vector biases the model toward behaviors associated with the positive class. Because language is one of the most linearly represented concepts in multilingual models, the output language reliably switches from English to French.",
      "This step uses a different model — Qwen/Qwen2.5-1.5B-Instruct — because language steering requires a model that has been trained on multiple languages and fine-tuned on instruction following. (Base models output incoherent continuations when steered.) The DIM approach itself is general: the same method works for sentiment, sycophancy, refusal, and many other behavioral dimensions across a wide range of model families.",
    ],
    whatToNotice: "Compare baseline_text (unsteered) and steered_text. The steered output should begin producing French words within the first few tokens. The logit_diff metric shows the quantitative magnitude of the shift. Try adjusting alpha after the tutorial — higher values produce stronger but sometimes less coherent steering.",
    caveat: "DIM/CAA works most reliably on in-distribution concept directions (language, sentiment) with ~20+ pairs. It generalizes less well to out-of-distribution prompts. Larger models are more resistant to steering-induced degradation. See Panickssery et al. 2023 for the theoretical framework and arXiv 2505.03189 for a 2025 analysis of when it works and when it doesn't.",
    links: [
      { label: "Panickssery et al. 2023 — Contrastive Activation Addition (CAA)", url: "https://arxiv.org/abs/2312.06681" },
      { label: "Zou et al. 2023 — Representation Engineering", url: "https://arxiv.org/abs/2310.01405" },
      { label: "Turner et al. 2023 — Activation Addition (original DIM paper)", url: "https://arxiv.org/abs/2308.10248" },
      { label: "Patterns and Mechanisms of CAA (2025)", url: "https://arxiv.org/abs/2505.03189" },
    ],
  },
];

export const TUTORIAL_CONFIGS = {
  lens: {
    modelName: "openai-community/gpt2",
    prompt: "When Mary and John went to the store, John gave a drink to",
    gpuTier: "tl_small",
    topK: 5,
  },
  attention: {
    modelName: "openai-community/gpt2",
    prompt: "When Mary and John went to the store, John gave a drink to",
    gpuTier: "tl_small",
  },
  dla: {
    modelName: "openai-community/gpt2",
    prompt: "When Mary and John went to the store, John gave a drink to",
    gpuTier: "tl_small",
    targetPosition: "last" as const,
    targetToken: " Mary",
    contrastiveToken: " John",
  },
  attribution: {
    modelName: "openai-community/gpt2",
    cleanPrompt: "When Mary and John went to the store, John gave a drink to",
    corruptedPrompt: "When John and Mary went to the store, Mary gave a drink to",
    gpuTier: "tl_small",
    targetPosition: "last" as const,
    targetToken: " Mary",
    contrastiveToken: " John",
  },
  activation: {
    modelName: "openai-community/gpt2",
    cleanPrompt: "When Mary and John went to the store, John gave a drink to",
    corruptedPrompt: "When John and Mary went to the store, Mary gave a drink to",
    gpuTier: "tl_small",
    targetPosition: "last" as const,
    targetToken: " Mary",
    contrastiveToken: " John",
    k: 10,
  },
  steering: {
    modelName: "Qwen/Qwen2.5-1.5B-Instruct",
    cleanPrompt: "The weather today is sunny and warm.",
    corruptedPrompt: "Le temps aujourd'hui est ensoleillé et chaud.",
    gpuTier: "tl_small",
    layer: 16,
  },
} as const;
