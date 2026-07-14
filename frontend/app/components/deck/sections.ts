import type { ComponentType } from "react";
import Hero from "../Hero";
import WhatDoppoIs from "../sections/WhatDoppoIs";
import Techniques from "../sections/Techniques";
import LearnMore from "../sections/LearnMore";

interface SectionProps {
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
  { id: "techniques", label: "techniques", Component: Techniques },
  { id: "self-hosting", label: "learn more", Component: LearnMore },
] as const;
