import type { Metadata } from "next";
import TutorialClient from "./TutorialClient";

export const metadata: Metadata = {
  title: "Tutorial — Doppo",
  description: "A guided walkthrough of six mechanistic interpretability tools on the canonical IOI circuit.",
};

export default function TutorialPage() {
  return <TutorialClient />;
}
