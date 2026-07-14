"use client";

import type { CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "../../lib/auth-client";
import { TactileButton } from "../ui/TactileButton";

// Copy + CTA behavior shared between the deck hero (Hero.tsx) and the flow
// hero (flow/FlowHero.tsx), so the session-gated Projects action exists once.
export const HERO_HEADLINE = "Doppo, a mechanistic interpretability sandbox.";

// Signed-in users go straight to /projects; signed-out users get the auth
// modal in signup mode (Navbar listens for the doppo:open-auth event).
function useProjectsCta(): () => void {
  const router = useRouter();
  const { data: session } = useSession();
  return () => {
    if (session?.user) {
      router.push("/projects");
    } else {
      window.dispatchEvent(
        new CustomEvent("doppo:open-auth", { detail: { mode: "signup" } }),
      );
    }
  };
}

export function HeroCtas({
  className,
  style,
  faceClassName,
}: {
  className?: string;
  style?: CSSProperties;
  faceClassName?: string;
}) {
  const onProjects = useProjectsCta();
  return (
    <>
      <TactileButton
        variant="ghost"
        block
        className={className}
        style={style}
        faceClassName={faceClassName}
        onClick={onProjects}
      >
        Projects
      </TactileButton>
      <TactileButton
        variant="ghost"
        href="/tutorial"
        block
        className={className}
        style={style}
        faceClassName={faceClassName}
      >
        Tutorial
      </TactileButton>
    </>
  );
}
