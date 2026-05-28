"use client";

import { useRef, useEffect } from "react";

const N_LAYERS = 12;

// Per-layer constants — computed once, not inside the draw loop
const LAYERS = Array.from({ length: N_LAYERS }, (_, i) => {
  const frac = i / (N_LAYERS - 1);
  return {
    // spatial frequency: later layers oscillate slightly faster across the width
    freqCycles: 1.4 + i * 0.19,
    // temporal speed: each layer drifts at its own pace (radians per frame)
    omega: 0.011 + i * 0.0014,
    // amplitude grows modestly with depth
    amp: 4.5 + frac * 7,
    // phase offset staggers the waves so they don't all peak simultaneously
    phi: i * (Math.PI / 2.6),
    // opacity: barely visible at the top, more present at the bottom
    opacity: 0.055 + frac * 0.19,
    lineWidth: 0.9 + frac * 0.4,
  };
});

export default function WaveformLayers() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseXRef = useRef(0.5); // normalized [0,1], defaults to center
  const frameRef = useRef(0);
  const animRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let alive = true;

    // ── Size sync ───────────────────────────────────────────────────────────
    function syncSize() {
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      if (w === 0 || h === 0) return;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    syncSize();
    const ro = new ResizeObserver(syncSize);
    ro.observe(canvas);

    // ── Mouse ───────────────────────────────────────────────────────────────
    function onMove(e: MouseEvent) {
      const rect = canvas.getBoundingClientRect();
      mouseXRef.current = (e.clientX - rect.left) / rect.width;
    }
    function onLeave() {
      // drift back to center over subsequent frames (handled in draw)
      mouseXRef.current = 0.5;
    }
    canvas.addEventListener("mousemove", onMove);
    canvas.addEventListener("mouseleave", onLeave);

    // ── Draw ────────────────────────────────────────────────────────────────
    function draw() {
      if (!alive) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const W = canvas.width / dpr;
      const H = canvas.height / dpr;
      const t = frameRef.current;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);

      const isDark = document.documentElement.getAttribute("data-theme") === "dark";
      // matches --color-text in each theme
      const [r, g, b] = isDark ? [220, 218, 210] : [28, 28, 28];

      const mx = mouseXRef.current * W;
      // gaussian sigma: disturbance is felt over ~15% of the width
      const sig2 = (W * 0.15) ** 2;

      for (let i = 0; i < N_LAYERS; i++) {
        const { freqCycles, omega, amp, phi, opacity, lineWidth } = LAYERS[i];
        const yCenter = (i + 0.5) * (H / N_LAYERS);
        const spatialFreq = (freqCycles * 2 * Math.PI) / W;

        ctx.beginPath();
        ctx.strokeStyle = `rgba(${r},${g},${b},${opacity})`;
        ctx.lineWidth = lineWidth;

        const step = Math.max(1, Math.floor(W / 320)); // ~320 points max
        for (let px = 0; px <= W; px += step) {
          // gaussian disturbance centered on mouse x — ripples at a faster rate
          const dx = px - mx;
          const gauss = Math.exp(-(dx * dx) / sig2);
          const disturbance = gauss * 6 * Math.sin(t * 0.07 + i * 0.6);

          const y =
            yCenter +
            amp * Math.sin(spatialFreq * px - omega * t + phi) +
            disturbance;

          if (px === 0) ctx.moveTo(px, y);
          else ctx.lineTo(px, y);
        }
        ctx.stroke();
      }

      frameRef.current += 1;
      animRef.current = requestAnimationFrame(draw);
    }

    draw();

    return () => {
      alive = false;
      cancelAnimationFrame(animRef.current);
      ro.disconnect();
      canvas.removeEventListener("mousemove", onMove);
      canvas.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: "100%", height: "100%", display: "block" }}
    />
  );
}
