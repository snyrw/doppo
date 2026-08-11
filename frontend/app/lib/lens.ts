/**
 * Candidate tokens the logit lens requests per cell.
 *
 * Frozen. Previously had a stepper, but decided to nix it to make things simpler
 * and for compute reasons discussed below.
 * 
 * -
 * 
 * It enters in exactly two places
 * (backend/inference.py): one `torch.topk` over the vocab, effectively flat in
 * k at these sizes, and a Python loop calling `tokenizer.decode()` once per id,
 * running n_layers x n_pos x k iterations.
 *
 * Only that loop is linear in k, and it runs on the worker inside the billed
 * window. An 80-layer model on a 48-token prompt is 19,200 decode calls at k=5
 * and 38,400 at k=10. Plus a doubled payload, since `topk_tokens` and
 * `topk_probs` are both [n_layers][n_pos][k] and both get written to the cache
 * row. Lose 6th-10th cells, which are a somewhat understandable loss given the
 * nature of this project.
 *
 * Mirrors lib/patching.ts's ATTRIBUTION_TOP_N: a frontend constant sent
 * upstream, rather than a literal restated per call site.
 */
export const LENS_TOP_K = 5;
