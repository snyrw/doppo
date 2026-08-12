import type { Metadata } from "next";
import TutorialClient from "./TutorialClient";
import { loadSteps } from "./load-steps";

export const metadata: Metadata = {
  title: "Demo",
  description: "An interactive preview of six mechanistic interpretability tools, pre-loaded on the canonical IOI circuit.",
};

export default function TutorialPage() {
  const steps = loadSteps();
  return <TutorialClient steps={steps} />;
}
