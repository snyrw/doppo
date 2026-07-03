import type { Dispatch } from "react";
import { phaseOf } from "../../lib/loading-stage";
import type { AppAction } from "../types";

// Fast polls while the first real stage is likely imminent, then back off.
const POLL_FAST_MS = 2000;
const POLL_SLOW_MS = 5000;
const POLL_FAST_WINDOW_MS = 30_000;

// On done, tick any timeline phases the polls never observed (fast jobs blow
// through them between polls) so the checks visibly complete before the
// result swaps in. Indexed by phase - 1; "done" is the all-checks state.
const SWEEP_STAGES = ["loading_model", "computing", "done"] as const;
const SWEEP_STEP_MS = 200;

type JobCtrl = { jobId: string | null; cancelled: boolean };

// One in-flight job per card. `cancelCardJob` flips the flag so the poll loop
// exits silently; the DELETE fires here when the jobId is already known,
// otherwise runJob fires it as soon as the spawn response arrives.
const jobsByCard = new Map<string, JobCtrl>();

export function cancelCardJob(cardId: string): void {
  const ctrl = jobsByCard.get(cardId);
  if (!ctrl) return;
  ctrl.cancelled = true;
  if (ctrl.jobId) fetch(`/api/job/${ctrl.jobId}`, { method: "DELETE" }).catch(() => {});
  jobsByCard.delete(cardId);
}

function handleSpawnError(
  status: number,
  err: { error?: string; code?: string }
): { error: string; showBuyCredits?: boolean; showVerifyCard?: boolean } {
  if (status === 402) return { error: err.error ?? "Insufficient credits", showBuyCredits: true };
  if (status === 403 && err.code === "verification_required")
    return { error: err.error ?? "Add a card to run this GPU tier.", showVerifyCard: true };
  if (status === 401) return { error: err.error ?? "Sign in to run inference" };
  return { error: err.error ?? `Request failed (${status})` };
}

/**
 * Shared spawn+poll lifecycle for every job-backed card: POST the spawn
 * endpoint, short-circuit on a cached result, otherwise poll /api/job/{id}
 * until done/error. `onResolve` dispatches the card's resolved action and
 * persists; `onError` runs extra cleanup on every error path and on cancel
 * via `cancelCardJob` (no CARD_ERRORED dispatch — the card is already gone).
 */
export async function runJob({ endpoint, body, cardId, startedAt, dispatch, onResolve, onError }: {
  endpoint: string;
  body: Record<string, unknown>;
  cardId: string;
  startedAt: number;
  dispatch: Dispatch<AppAction>;
  onResolve: (data: unknown) => void;
  onError?: () => void;
}): Promise<void> {
  const ctrl: JobCtrl = { jobId: null, cancelled: false };
  jobsByCard.set(cardId, ctrl);

  const fail = (error: string, showBuyCredits?: boolean, showVerifyCard?: boolean) => {
    dispatch({ type: "CARD_ERRORED", id: cardId, error, showBuyCredits, showVerifyCard });
    onError?.();
  };

  try {
    let spawnRes: Response;
    try {
      spawnRes = await fetch(endpoint, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch (err) {
      fail(err instanceof Error ? err.message : "Network error");
      return;
    }
    if (!spawnRes.ok) {
      const err = await spawnRes.json().catch(() => ({})) as { error?: string; code?: string };
      const { error, showBuyCredits, showVerifyCard } = handleSpawnError(spawnRes.status, err);
      fail(error, showBuyCredits, showVerifyCard);
      return;
    }

    const spawnBody = await spawnRes.json() as { status?: string; jobId?: string; data?: unknown };
    if (spawnBody.status === "cached" && spawnBody.data) {
      if (!ctrl.cancelled) onResolve(spawnBody.data);
      return;
    }
    if (!spawnBody.jobId) {
      fail("Spawn returned no job ID");
      return;
    }
    const jobId = spawnBody.jobId;
    ctrl.jobId = jobId;
    // Card was removed while the spawn request was in flight — the jobId
    // wasn't known yet, so cancelCardJob couldn't fire the DELETE itself.
    if (ctrl.cancelled) {
      fetch(`/api/job/${jobId}`, { method: "DELETE" }).catch(() => {});
      onError?.();
      return;
    }

    let lastStage: string | null = null;
    while (true) {
      const interval = Date.now() - startedAt < POLL_FAST_WINDOW_MS ? POLL_FAST_MS : POLL_SLOW_MS;
      await new Promise(resolve => setTimeout(resolve, interval));
      if (ctrl.cancelled) {
        onError?.();
        return;
      }
      let pollRes: Response;
      try {
        pollRes = await fetch(`/api/job/${jobId}`);
      } catch {
        fail("Lost connection to server");
        fetch(`/api/job/${jobId}`, { method: "DELETE" }).catch(() => {});
        return;
      }
      if (ctrl.cancelled) {
        onError?.();
        return;
      }
      if (!pollRes.ok) {
        fail(`Poll failed (${pollRes.status})`);
        return;
      }

      const result = await pollRes.json() as {
        status: string; data?: unknown; error?: string;
        stage?: string | null; stageAgeS?: number | null;
        progress?: { doneBytes: number; totalBytes: number | null } | null;
      };
      if (result.status === "done") {
        window.dispatchEvent(new CustomEvent("credits-updated"));
        for (const stage of SWEEP_STAGES.slice(phaseOf(lastStage) - 1)) {
          dispatch({
            type: "CARD_STAGE",
            id: cardId,
            stage: { stage, stageAgeS: null, progress: null },
          });
          await new Promise(resolve => setTimeout(resolve, SWEEP_STEP_MS));
          if (ctrl.cancelled) {
            onError?.();
            return;
          }
        }
        onResolve(result.data);
        return;
      }
      if (result.status === "error") {
        fail(result.error ?? "Unknown error");
        return;
      }
      // status === "running": relay the raw stage key; all humanization
      // happens in lib/loading-stage.ts at render time.
      lastStage = result.stage ?? lastStage;
      dispatch({
        type: "CARD_STAGE",
        id: cardId,
        stage: {
          stage: result.stage ?? null,
          stageAgeS: result.stageAgeS ?? null,
          progress: result.progress ?? null,
        },
      });
    }
  } finally {
    if (jobsByCard.get(cardId) === ctrl) jobsByCard.delete(cardId);
  }
}
