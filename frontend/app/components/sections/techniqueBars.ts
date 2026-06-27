// The five workbench techniques, top → bottom, as drawn in Figma node 15:483.
// Each is a tactile bar: a colored `face` sitting above a darker `shadow` lip.
// Colors are transcribed verbatim from the mock (one-off decorative palette, so
// intentionally literal rather than design tokens). White labels per the mock.
export interface Technique {
  name: string;
  face: string;
  shadow: string;
}

export const TECHNIQUES: readonly Technique[] = [
  { name: "logit lens", face: "#d88585", shadow: "#c16060" },
  { name: "attention head analysis", face: "#d8be85", shadow: "#ba9952" },
  { name: "direct logit attribution", face: "#a2ba8b", shadow: "#699440" },
  { name: "patching", face: "#7399a6", shadow: "#4e8597" },
  { name: "steering", face: "#7e5987", shadow: "#5e286b" },
] as const;
