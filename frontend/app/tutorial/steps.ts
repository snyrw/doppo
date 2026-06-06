export type TutorialLink = {
  label: string;
  url: string;
};

export type TutorialStep = {
  index: number;
  label: string;
  badge?: string;
  part?: string;
  cardType?: "logit-lens" | "attention-pattern" | "dla" | "attribution" | "activation" | "steering";
  configType?: "lens" | "attention" | "dla" | "attribution" | "activation" | "steering";
  heading: string;
  paragraphs: (string | { type: "image"; src: string; alt: string })[];
  whatToNotice?: string;
  caveat?: string;
  links: TutorialLink[];
};

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
    cleanPrompt: "What is the best way to learn a new language?",
    corruptedPrompt: "Quelle est la meilleure façon d'apprendre une nouvelle langue?",
    generationPrompt: "What do you think about climate change?",
    nPairs: 40,
    gpuTier: "tl_small",
    layer: 14,
  },
} as const;
