// frontend/app/lib/featured-models.ts
import type { GpuTier } from "./api-helpers";

export type FeaturedModel = {
  id: string;
  display_name: string;
  description: string;
  model_id: string;
  requires_hf_token: boolean;
  gpu_tier: GpuTier;
};

export const FEATURED_MODELS: Record<string, FeaturedModel> = {
  // ── GPT-2 ────────────────────────────────────────────────────────────────
  "gpt2-small": {
    id: "gpt2-small",
    display_name: "GPT-2 Small",
    description: "OpenAI · 12 layers · 117M params",
    model_id: "openai-community/gpt2",
    requires_hf_token: false,
    gpu_tier: "tl_small",
  },
  "gpt2-medium": {
    id: "gpt2-medium",
    display_name: "GPT-2 Medium",
    description: "OpenAI · 24 layers · 345M params",
    model_id: "openai-community/gpt2-medium",
    requires_hf_token: false,
    gpu_tier: "tl_small",
  },
  "gpt2-large": {
    id: "gpt2-large",
    display_name: "GPT-2 Large",
    description: "OpenAI · 36 layers · 762M params",
    model_id: "openai-community/gpt2-large",
    requires_hf_token: false,
    gpu_tier: "tl_small",
  },
  "gpt2-xl": {
    id: "gpt2-xl",
    display_name: "GPT-2 XL",
    description: "OpenAI · 48 layers · 1.5B params",
    model_id: "openai-community/gpt2-xl",
    requires_hf_token: false,
    gpu_tier: "tl_small",
  },
  // ── Llama 3 ──────────────────────────────────────────────────────────────
  "meta-llama/Meta-Llama-3-8B": {
    id: "meta-llama/Meta-Llama-3-8B",
    display_name: "Llama 3 (8B)",
    description: "Meta · 32 layers · 8K ctx",
    model_id: "meta-llama/Meta-Llama-3-8B",
    requires_hf_token: true,
    gpu_tier: "tl_medium",
  },
  "meta-llama/Llama-3.2-3B-Instruct": {
    id: "meta-llama/Llama-3.2-3B-Instruct",
    display_name: "Llama 3.2 Instruct (3B)",
    description: "Meta · 28 layers · 128K ctx",
    model_id: "meta-llama/Llama-3.2-3B-Instruct",
    requires_hf_token: true,
    gpu_tier: "tl_small",
  },
  "meta-llama/Meta-Llama-3.1-8B-Instruct": {
    id: "meta-llama/Meta-Llama-3.1-8B-Instruct",
    display_name: "Llama 3.1 Instruct (8B)",
    description: "Meta · 32 layers · 128K ctx",
    model_id: "meta-llama/Meta-Llama-3.1-8B-Instruct",
    requires_hf_token: true,
    gpu_tier: "tl_medium",
  },
  // ── Qwen ─────────────────────────────────────────────────────────────────
  "Qwen/Qwen2.5-7B": {
    id: "Qwen/Qwen2.5-7B",
    display_name: "Qwen 2.5 (7B)",
    description: "Alibaba · 28 layers · 128K ctx",
    model_id: "Qwen/Qwen2.5-7B",
    requires_hf_token: false,
    gpu_tier: "tl_medium",
  },
  "Qwen/Qwen2.5-7B-Instruct": {
    id: "Qwen/Qwen2.5-7B-Instruct",
    display_name: "Qwen 2.5 Instruct (7B)",
    description: "Alibaba · 28 layers · 128K ctx",
    model_id: "Qwen/Qwen2.5-7B-Instruct",
    requires_hf_token: false,
    gpu_tier: "tl_medium",
  },
  "Qwen/Qwen3-0.6B": {
    id: "Qwen/Qwen3-0.6B",
    display_name: "Qwen3 (0.6B)",
    description: "Alibaba · 28 layers · 32K ctx",
    model_id: "Qwen/Qwen3-0.6B",
    requires_hf_token: false,
    gpu_tier: "tl_small",
  },
  "Qwen/Qwen3-8B": {
    id: "Qwen/Qwen3-8B",
    display_name: "Qwen3 (8B)",
    description: "Alibaba · 36 layers · 128K ctx",
    model_id: "Qwen/Qwen3-8B",
    requires_hf_token: false,
    gpu_tier: "tl_medium",
  },
  "Qwen/Qwen3-14B": {
    id: "Qwen/Qwen3-14B",
    display_name: "Qwen3 (14B)",
    description: "Alibaba · 40 layers · 128K ctx",
    model_id: "Qwen/Qwen3-14B",
    requires_hf_token: false,
    gpu_tier: "tl_large",
  },
  // ── Gemma ────────────────────────────────────────────────────────────────
  "google/gemma-3-1b-it": {
    id: "google/gemma-3-1b-it",
    display_name: "Gemma 3 (1B)",
    description: "Google · 18 layers · 32K ctx",
    model_id: "google/gemma-3-1b-it",
    requires_hf_token: true,
    gpu_tier: "tl_small",
  },
  "google/gemma-3-4b-it": {
    id: "google/gemma-3-4b-it",
    display_name: "Gemma 3 (4B)",
    description: "Google · 34 layers · 128K ctx",
    model_id: "google/gemma-3-4b-it",
    requires_hf_token: true,
    gpu_tier: "tl_small",
  },
  "google/gemma-3-27b-it": {
    id: "google/gemma-3-27b-it",
    display_name: "Gemma 3 (27B)",
    description: "Google · 62 layers · 128K ctx",
    model_id: "google/gemma-3-27b-it",
    requires_hf_token: true,
    gpu_tier: "tl_xlarge",
  },
  "google/gemma-2-2b-it": {
    id: "google/gemma-2-2b-it",
    display_name: "Gemma 2 (2B)",
    description: "Google · 26 layers · 8K ctx",
    model_id: "google/gemma-2-2b-it",
    requires_hf_token: true,
    gpu_tier: "tl_small",
  },
  "google/gemma-2-9b-it": {
    id: "google/gemma-2-9b-it",
    display_name: "Gemma 2 (9B)",
    description: "Google · 42 layers · 8K ctx",
    model_id: "google/gemma-2-9b-it",
    requires_hf_token: true,
    gpu_tier: "tl_medium",
  },
  "google/gemma-2-27b-it": {
    id: "google/gemma-2-27b-it",
    display_name: "Gemma 2 (27B)",
    description: "Google · 46 layers · 8K ctx",
    model_id: "google/gemma-2-27b-it",
    requires_hf_token: true,
    gpu_tier: "tl_xlarge",
  },
  // ── XL tier (H200) ───────────────────────────────────────────────────────
  "Qwen/Qwen3-30B": {
    id: "Qwen/Qwen3-30B",
    display_name: "Qwen3 (32B)",
    description: "Alibaba · 64 layers · 128K ctx",
    model_id: "Qwen/Qwen3-30B",
    requires_hf_token: false,
    gpu_tier: "tl_xlarge",
  },
  "meta-llama/Llama-3.3-70B-Instruct": {
    id: "meta-llama/Llama-3.3-70B-Instruct",
    display_name: "Llama 3.3 Instruct (70B)",
    description: "Meta · 80 layers · 128K ctx",
    model_id: "meta-llama/Llama-3.3-70B-Instruct",
    requires_hf_token: true,
    gpu_tier: "tl_xxlarge",
  },
};
