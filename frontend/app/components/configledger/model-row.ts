/* Turns a featured model's editorial `description` into the fields the
   one-line picker row shows.

   Pure — no React import — so vitest's `node` environment can load it.

   /api/models returns { id, display_name, description, requires_hf_token,
   gpu_tier }. There is no company or params field: `description` is one
   "·"-joined string written by hand in backend/config.py, and across the 20
   featured entries its third segment is params for only the 4 GPT-2 models and
   context length for the other 16. So company and layers are parsed out, and
   params is included in the meta only when `display_name` does not already
   carry it — it is already inside `display_name` for 16 of 20 ("Llama 3
   (8B)"), and rendering both would duplicate it on those 16 rows.

   Restructuring FEATURED_MODELS into real fields was considered and rejected:
   it needs param counts hand-looked-up for 16 models and an /api/models
   contract change, and the backend deploys on push, not commit — it would stop
   this being a frontend-only ship. */

import { TIER_LABELS } from "../../lib/tiers";

const SEP = " · ";

export function parseModelMeta(description: string): {
  company: string;
  params: string | null;
  layers: string | null;
} {
  const parts = description.split(SEP).map(p => p.trim()).filter(Boolean);
  const layerPart = parts.find(p => /^\d+\s+layers?$/.test(p));
  const paramPart = parts.find(p => /^[\d.]+[MB]\s+params$/.test(p));
  return {
    company: parts[0] ?? "",
    params: paramPart ? paramPart.split(/\s+/)[0] : null,
    layers: layerPart ? layerPart.split(/\s+/)[0] : null,
  };
}

/**
 * Does `display_name` already state the parameter count?
 *
 * True for the 16 entries written `Llama 3 (8B)`, false for the four GPT-2 ones
 * written `GPT-2 Small`. The `[MB]` guard keeps it from matching a parenthetical
 * that is not a size — `(Instruct)` would otherwise read as one.
 */
export function nameCarriesParams(displayName: string): boolean {
  return /\([^)]*[\d.][MB]\)/.test(displayName);
}

/**
 * The row's right-hand column: "OpenAI · 117M · 12L · L4", or
 * "Meta · 32L · L40S" when the name already carries the size.
 *
 * Params is included only when `display_name` does not already state it, so
 * every row shows the parameter count exactly once. Stripping the parenthetical
 * from the name instead was rejected: it makes four models read as `Qwen3`.
 */
export function formatModelMeta(
  description: string,
  displayName: string,
  gpuTier?: string,
): string {
  const { company, params, layers } = parseModelMeta(description);
  if (!company) return "";
  const fields = [company];
  if (params && !nameCarriesParams(displayName)) fields.push(params);
  if (layers) fields.push(`${layers}L`);
  const gpu = gpuTier ? TIER_LABELS[gpuTier] : undefined;
  if (gpu) fields.push(gpu);
  return fields.join(SEP);
}
