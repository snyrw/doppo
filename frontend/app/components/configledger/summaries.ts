/** Truncate to `max` chars, appending an ellipsis when cut. */
export function ellipsize(text: string, max = 32): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1) + "…";
}

/** Quoted, ellipsized prompt for a rail/footer summary; "empty" when blank. */
export function promptSummary(prompt: string, max = 32): string {
  const t = prompt.trim();
  if (t === "") return "empty";
  return `"${ellipsize(t, max - 1)}"`;
}

export function positionSummary(mode: "last" | "custom", custom: string): string {
  if (mode === "custom" && custom.trim() !== "") return `pos ${custom.trim()}`;
  return "last";
}

export function targetTokenSummary(mode: "auto" | "custom", custom: string): string {
  if (mode === "custom" && custom.trim() !== "") return `"${custom}"`;
  return "auto";
}

export function targetSummary(args: {
  positionMode: "last" | "custom";
  customPosition: string;
  tokenMode: "auto" | "custom";
  customToken: string;
  contrastiveToken: string;
}): string {
  const parts = [
    positionSummary(args.positionMode, args.customPosition),
    targetTokenSummary(args.tokenMode, args.customToken),
  ];
  if (args.contrastiveToken.trim() !== "") parts.push(`vs "${args.contrastiveToken}"`);
  return parts.join(" · ");
}

export function injectionSummary(injectionLayer: string): string {
  const t = injectionLayer.trim();
  return t === "" ? "layer auto" : `L${t}`;
}

export function generationSummary(temperature: number, repetitionPenalty: number): string {
  return `T ${temperature.toFixed(1)} · rep ${repetitionPenalty.toFixed(1)}`;
}

export function decodingSummary(topK: number): string {
  return `top-${topK}`;
}

export function modelSummary(displayName: string | null | undefined): string {
  return displayName && displayName.trim() !== "" ? displayName : "no model";
}
