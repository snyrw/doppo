/**
 * Single home for job loading-stage semantics. Raw backend stage keys flow
 * from the poll response through CARD_STAGE to the cards; this module — and
 * only this module — turns them into display text and timeline phases.
 * (Cards previously re-mapped already-humanized text through raw-key lookups,
 * so worker stages never rendered. Don't reintroduce a second mapping layer.)
 */

type LoadingProgress = { doneBytes: number; totalBytes: number | null };

export type LoadingStage = {
  /** Raw backend stage key; null while the poll has no signal yet. */
  stage: string | null;
  stageAgeS: number | null;
  progress: LoadingProgress | null;
};

export type LoadingPhase = 1 | 2 | 3 | 4;

/**
 * Timeline phase: 1 waiting for a GPU, 2 container loading the model,
 * 3 computing, 4 complete (synthetic "done" sweep stage — all checks shown
 * while the job-runner plays the timeline through before resolving).
 */
export function phaseOf(stage: string | null | undefined): LoadingPhase {
  if (!stage || stage === "queued") return 1;
  if (
    stage === "starting_runtime" ||
    stage === "downloading_weights" ||
    stage === "loading_model" ||
    stage === "loading_model_cached"
  )
    return 2;
  if (stage === "done") return 4;
  return 3;
}

const STAGE_LABELS: Record<string, string> = {
  queued: "Waiting for a GPU…",
  starting_runtime: "GPU attached, starting runtime…",
  downloading_weights: "Downloading model weights…",
  loading_model: "Loading model into GPU memory…",
  loading_model_cached: "Weights cached, loading into GPU memory…",
  starting: "Starting…",
  tokenizing: "Tokenizing…",
  forward_pass: "Running forward pass…",
  clean_forward_pass: "Running clean forward pass…",
  corrupted_forward_backward: "Running backward pass…",
  computing: "Computing…",
  computing_attribution: "Computing attribution…",
  computing_effects: "Computing effects…",
  preparing: "Preparing…",
  token: "Generating…",
};

// The worker heartbeat rewrites its entry every ~10s even mid-stage; a much
// older timestamp means stalled worker or dead container, not a slow stage.
const STALE_STAGE_S = 45;

export function formatGb(bytes: number): string {
  return (bytes / 1024 ** 3).toFixed(1);
}

/**
 * Display text for the active stage. `labels` lets a card override shared
 * copy per raw key (e.g. computing → "Computing logit lens…"); the special
 * key "patching" is a template with {i}/{n} placeholders.
 */
export function stageText(ls: LoadingStage, labels?: Record<string, string>): string {
  const stage = ls.stage ?? "queued";
  const patching = stage.match(/^patching_(\d+)_of_(\d+)$/);
  let text: string;
  if (patching) {
    const tpl = labels?.patching ?? "Patching component {i} of {n}…";
    text = tpl.replace("{i}", patching[1]).replace("{n}", patching[2]);
  } else {
    text = labels?.[stage] ?? STAGE_LABELS[stage] ?? `${stage.replace(/_/g, " ")}…`;
  }
  if (ls.stageAgeS !== null && ls.stageAgeS > STALE_STAGE_S)
    text += ` (no progress for ${Math.round(ls.stageAgeS)}s)`;
  return text;
}
