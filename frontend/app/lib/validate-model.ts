// frontend/app/lib/validate-model.ts
import type { GpuTier } from "./api-helpers";
import { detectGpuTier } from "./featured-models";

export type ValidationResult = {
  valid: boolean;
  gpu_tier: GpuTier | null;
  reason: string;
};

/**
 * Validate a HuggingFace repo before loading it on GPU.
 * Checks: existence, safetensors format, no LoRA, no trust_remote_code, no custom auto_map.
 * Detects GPU tier from config.json. Server-side only — reads HF_TOKEN from env.
 */
export async function validateHfRepo(repoId: string): Promise<ValidationResult> {
  const hfToken = process.env.HF_TOKEN;
  const authHeaders: Record<string, string> = {};
  if (hfToken) authHeaders["Authorization"] = `Bearer ${hfToken}`;

  const encodedRepoId = repoId.split("/").map(encodeURIComponent).join("/");

  // 1. Fetch model metadata (includes full file list via siblings).
  let siblings: Array<{ rfilename: string }>;
  try {
    const res = await fetch(
      `https://huggingface.co/api/models/${encodedRepoId}?full=true`,
      { headers: authHeaders }
    );
    if (res.status === 404 || res.status === 401 || res.status === 403) {
      return {
        valid: false,
        gpu_tier: null,
        reason: `Repository '${repoId}' not found or is private (check your HF token).`,
      };
    }
    if (!res.ok) {
      return { valid: false, gpu_tier: null, reason: `Could not list repo files: HTTP ${res.status}` };
    }
    const json = (await res.json()) as { siblings?: Array<{ rfilename: string }> };
    siblings = json.siblings ?? [];
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { valid: false, gpu_tier: null, reason: `Could not list repo files: ${msg}` };
  }

  const fileSet = new Set(siblings.map((s) => s.rfilename));

  // 2. Reject LoRA/PEFT adapters.
  if (fileSet.has("adapter_config.json")) {
    return {
      valid: false,
      gpu_tier: null,
      reason: "LoRA/PEFT adapters are not supported — upload the merged full-weight model instead.",
    };
  }

  // 3. Require safetensors format.
  const hasSafetensors = [...fileSet].some(
    (f) => f.endsWith(".safetensors") || f.endsWith(".safetensors.index.json")
  );
  const hasPickleOnly =
    !hasSafetensors && [...fileSet].some((f) => f.endsWith(".bin") || f.endsWith(".pt"));
  if (hasPickleOnly) {
    return {
      valid: false,
      gpu_tier: null,
      reason:
        "Repository contains only pickle (.bin/.pt) weights, which are unsafe to load. Re-upload in safetensors format.",
    };
  }
  if (!hasSafetensors) {
    return {
      valid: false,
      gpu_tier: null,
      reason: "No safetensors weights found. Only the safetensors format is supported.",
    };
  }

  // 4. Detect GPU tier and check config for unsafe flags.
  let gpuTier: GpuTier = "tl_large"; // conservative default when config.json absent
  if (fileSet.has("config.json")) {
    try {
      const configRes = await fetch(
        `https://huggingface.co/${encodedRepoId}/resolve/main/config.json`,
        { headers: authHeaders }
      );
      if (configRes.ok) {
        const config = (await configRes.json()) as Record<string, unknown>;

        if (config.trust_remote_code === true) {
          return {
            valid: false,
            gpu_tier: null,
            reason: "Model config sets trust_remote_code=True, which is not allowed.",
          };
        }

        if (config.auto_map && typeof config.auto_map === "object") {
          const customModules = Object.values(config.auto_map as Record<string, string>).filter(
            (v) => typeof v === "string" && v.includes(".") && !v.startsWith("transformers.")
          );
          if (customModules.length > 0) {
            return {
              valid: false,
              gpu_tier: null,
              reason: "Model config uses auto_map with custom module paths, which is not allowed.",
            };
          }
        }

        const detected = detectGpuTier(config);
        if (detected === null) {
          return {
            valid: false,
            gpu_tier: null,
            reason:
              "Model appears to exceed ~70B parameters. Single-GPU limit is 70B on H200 — choose a smaller model.",
          };
        }
        gpuTier = detected;
      }
    } catch {
      // config.json unreadable — fall through to conservative default
    }
  }

  return { valid: true, gpu_tier: gpuTier, reason: "OK" };
}
