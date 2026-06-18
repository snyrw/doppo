import type { Dispatch } from "react";
import type { AppAction } from "../types";

const POLL_INTERVAL_MS = 5000;

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

function heuristicStage(elapsed: number, finalStage: string): string {
  if (elapsed < 30_000) return "Connecting to GPU…";
  if (elapsed < 90_000) return "Loading model…";
  return finalStage;
}

/**
 * Shared spawn+poll lifecycle for every job-backed card: POST the spawn
 * endpoint, short-circuit on a cached result, otherwise poll /api/job/{id}
 * until done/error. `onResolve` dispatches the card's resolved action and
 * persists; `onError` runs extra cleanup on every error path.
 */
export async function runJob({ endpoint, body, cardId, startedAt, dispatch, finalStage = "Running computation…", onResolve, onError }: {
  endpoint: string;
  body: Record<string, unknown>;
  cardId: string;
  startedAt: number;
  dispatch: Dispatch<AppAction>;
  finalStage?: string;
  onResolve: (data: unknown) => void;
  onError?: () => void;
}): Promise<void> {
  const fail = (error: string, showBuyCredits?: boolean, showVerifyCard?: boolean) => {
    dispatch({ type: "CARD_ERRORED", id: cardId, error, showBuyCredits, showVerifyCard });
    onError?.();
  };

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
    onResolve(spawnBody.data);
    return;
  }
  if (!spawnBody.jobId) {
    fail("Spawn returned no job ID");
    return;
  }
  const jobId = spawnBody.jobId;

  while (true) {
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
    dispatch({ type: "CARD_STAGE", id: cardId, stage: heuristicStage(Date.now() - startedAt, finalStage) });

    let pollRes: Response;
    try {
      pollRes = await fetch(`/api/job/${jobId}`);
    } catch {
      fail("Lost connection to server");
      fetch(`/api/job/${jobId}`, { method: "DELETE" }).catch(() => {});
      return;
    }
    if (!pollRes.ok) {
      fail(`Poll failed (${pollRes.status})`);
      return;
    }

    const result = await pollRes.json() as { status: string; data?: unknown; error?: string };
    if (result.status === "done") {
      window.dispatchEvent(new CustomEvent("credits-updated"));
      onResolve(result.data);
      return;
    }
    if (result.status === "error") {
      fail(result.error ?? "Unknown error");
      return;
    }
    // status === "running": continue loop
  }
}
