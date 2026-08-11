"use client";

import { useState } from "react";

/**
 * The open/reset/close lifecycle every config pane shares: an active section
 * that returns to "model" on reset, and a close handler that resets state
 * before calling the pane's own onClose. Each pane still owns its own field
 * state — `resetFields` is where it clears that.
 */
export function useConfigPaneLifecycle(onClose: () => void, resetFields: () => void) {
  const [activeSection, setActiveSection] = useState("model");

  const doReset = () => {
    resetFields();
    setActiveSection("model");
  };

  const handleClose = () => {
    doReset();
    onClose();
  };

  return { activeSection, setActiveSection, doReset, handleClose };
}
