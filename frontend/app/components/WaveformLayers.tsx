"use client";

import { useRef, useEffect } from "react";

// ─── Constants ────────────────────────────────────────────────────────────────

const SPACING = 32;
const SWELL   = 9;
const PERIOD  = 192;
const LW_BG   = 4;
const LW_TIP  = 5;
const BG_A    = 0.07;
const TIP_MAX = 0.55;
const TAIL    = 280;
const SPEED   = 0.10;
const STEP    = 6;    // path vertex step (was 4/5) — 33% fewer vertices per frame
const MAX_DPR = 2;    // cap pixel ratio; prevents 9× canvas area on 3× displays

// Precomputed sine LUT — eliminates all Math.sin calls during animation.
// Index = y mod PERIOD (integer), value = SWELL·sin(2π·y/PERIOD).
const SIN_TABLE = new Float32Array(PERIOD);
for (let i = 0; i < PERIOD; i++) {
  SIN_TABLE[i] = SWELL * Math.sin(2 * Math.PI * i / PERIOD);
}

// Odd lines use phase=π, so sin(...+π) = -sin(...). Pass sign=-1 from the caller.
function sinAt(y: number): number {
  return SIN_TABLE[((y | 0) % PERIOD + PERIOD) % PERIOD];
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function WaveformLayers() {
  const cvRef     = useRef<HTMLCanvasElement>(null);
  const ctxRef    = useRef<CanvasRenderingContext2D | null>(null);
  const yDrawRef  = useRef<Float32Array>(new Float32Array(0));
  const multRef   = useRef<Float32Array>(new Float32Array(0));
  const animRef   = useRef<number>(0);
  const lastTRef  = useRef<number>(0);
  const seededRef = useRef(false);
  const bgRef     = useRef<{ canvas: HTMLCanvasElement; w: number; h: number; dark: boolean } | null>(null);
  const darkRef   = useRef(false);

  useEffect(() => {
    const cv = cvRef.current;
    if (!cv) return;
    let alive = true;

    // Cache the context — avoids a getContext() call every frame.
    ctxRef.current = cv.getContext("2d");

    // Track theme changes with MutationObserver instead of querying the DOM each frame.
    darkRef.current = document.documentElement.getAttribute("data-theme") === "dark";
    const themeObs = new MutationObserver(() => {
      const d = document.documentElement.getAttribute("data-theme") === "dark";
      if (d !== darkRef.current) { darkRef.current = d; bgRef.current = null; }
    });
    themeObs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    const sync = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      const w = cv.offsetWidth, h = cv.offsetHeight;
      if (!w || !h) return;
      cv.width  = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
      ctxRef.current = cv.getContext("2d");
      seededRef.current = false;
      bgRef.current = null;
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(cv);

    const tick = (now: number) => {
      if (!alive) return;

      // Throttle to ~30 fps — this is a decorative background; 30 fps is imperceptible
      // and halves all per-frame CPU work.
      if (lastTRef.current !== 0 && now - lastTRef.current < 32) {
        animRef.current = requestAnimationFrame(tick);
        return;
      }

      const ctx = ctxRef.current;
      if (!ctx) { animRef.current = requestAnimationFrame(tick); return; }

      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      const W = cv.width / dpr, H = cv.height / dpr;
      if (!W || !H) { animRef.current = requestAnimationFrame(tick); return; }

      const dt = lastTRef.current === 0 ? 16 : Math.min(now - lastTRef.current, 50);
      lastTRef.current = now;

      const nLines = Math.ceil(W / SPACING) + 4;

      // Seed tips and precompute per-line speed multipliers (avoids Math.sin each frame).
      if (!seededRef.current || yDrawRef.current.length !== nLines) {
        seededRef.current = true;
        yDrawRef.current = new Float32Array(nLines);
        multRef.current  = new Float32Array(nLines);
        for (let i = 0; i < nLines; i++) {
          yDrawRef.current[i] = -TAIL + Math.random() * (H + 2 * TAIL);
          multRef.current[i]  = 0.65 + 0.70 * (Math.sin(i * 1.6180) * 0.5 + 0.5);
        }
      }

      const ys   = yDrawRef.current;
      const mult = multRef.current;

      for (let i = 0; i < nLines; i++) {
        ys[i] += SPEED * mult[i] * dt;
        if (ys[i] > H + TAIL) ys[i] -= (H + 2 * TAIL);
      }

      // ── Offscreen background ─────────────────────────────────────────────
      const dark = darkRef.current;
      let bg = bgRef.current;
      if (!bg || bg.w !== W || bg.h !== H || bg.dark !== dark) {
        const oc  = document.createElement("canvas");
        oc.width  = cv.width;
        oc.height = cv.height;
        const bc  = oc.getContext("2d")!;
        bc.setTransform(dpr, 0, 0, dpr, 0, 0);

        const [r, g, b] = dark ? [180, 178, 170] : [80, 78, 72];
        bc.strokeStyle = `rgba(${r},${g},${b},${BG_A})`;
        bc.lineWidth   = LW_BG;
        bc.lineCap     = "butt";

        for (let i = 0; i < nLines; i++) {
          const sign = i % 2 === 0 ? 1 : -1;
          const cx   = (i - 1.5) * SPACING;
          bc.beginPath();
          bc.moveTo(cx + sign * sinAt(-1), -1);
          for (let y = 4; y <= H; y += 5) {
            bc.lineTo(cx + sign * sinAt(y), y);
          }
          bc.stroke();
        }

        bgRef.current = { canvas: oc, w: W, h: H, dark };
        bg = bgRef.current;
      }

      // ── Render ────────────────────────────────────────────────────────────
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);

      ctx.save();
      ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();

      ctx.drawImage(bg.canvas, 0, 0, W, H);

      const [r, g, b] = dark ? [180, 178, 170] : [80, 78, 72];
      ctx.lineWidth = LW_TIP;
      ctx.lineCap   = "butt";

      for (let i = 0; i < nLines; i++) {
        const yDraw = ys[i];
        const sign  = i % 2 === 0 ? 1 : -1;
        const cx    = (i - 1.5) * SPACING;

        const effectiveTip = Math.min(yDraw, H);
        const exitFade = yDraw > H ? Math.max(0, 1 - (yDraw - H) / TAIL) : 1;

        const tailY = effectiveTip - TAIL;
        const vTop  = Math.max(0, tailY);
        const vBot  = effectiveTip;
        if (vBot <= vTop) continue;

        const aTop = TIP_MAX * exitFade * (vTop - tailY) / TAIL;
        const aBot = TIP_MAX * exitFade;

        const grad = ctx.createLinearGradient(0, vTop, 0, vBot);
        grad.addColorStop(0, `rgba(${r},${g},${b},${aTop.toFixed(3)})`);
        grad.addColorStop(1, `rgba(${r},${g},${b},${aBot.toFixed(3)})`);
        ctx.strokeStyle = grad;

        const pathY0 = vTop > 0 ? vTop : -1;
        ctx.beginPath();
        ctx.moveTo(cx + sign * sinAt(pathY0), pathY0);
        for (let y = pathY0 + STEP; y <= vBot; y += STEP) {
          ctx.lineTo(cx + sign * sinAt(y), y);
        }
        ctx.stroke();
      }

      ctx.restore();
      animRef.current = requestAnimationFrame(tick);
    };

    animRef.current = requestAnimationFrame(tick);
    return () => {
      alive = false;
      cancelAnimationFrame(animRef.current);
      ro.disconnect();
      themeObs.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={cvRef}
      style={{ width: "100%", height: "100%", display: "block" }}
    />
  );
}
