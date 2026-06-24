import type { ComponentType } from "react";
import Hero from "../Hero";
import WhatDoppoIs from "../sections/WhatDoppoIs";
import PlaceholderSection from "../sections/PlaceholderSection";

export interface SectionProps {
  label: string;
}

export interface SectionDef {
  id: string;
  label: string;
  Component: ComponentType<SectionProps>;
}

export const SECTIONS: readonly SectionDef[] = [
  { id: "intro", label: "intro", Component: Hero },
  { id: "what-doppo-is", label: "what doppo is", Component: WhatDoppoIs },
  { id: "pricing", label: "pricing", Component: PlaceholderSection },
  { id: "self-hosting", label: "self-hosting", Component: PlaceholderSection },
] as const;
