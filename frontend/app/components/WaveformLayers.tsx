"use client";

import { useRef, useEffect } from "react";

// ─── Constants ────────────────────────────────────────────────────────────────

const SPACING = 32;    // px between sinusoidal lines
const SWELL   = 9;     // px horizontal amplitude
const PERIOD  = 192;   // px per full wave
const LW_BG   = 4;     // background grid stroke weight
const LW_TIP  = 5;     // drawing tip stroke weight
const BG_A    = 0.07;  // background grid alpha
const TIP_MAX = 0.55;  // peak alpha at the drawing tip
const TAIL    = 280;   // px of fading trail behind each tip
const SPEED   = 0.10;  // px/ms descent speed

// ─── Component ────────────────────────────────────────────────────────────────

export default function WaveformLayers() {
  const cvRef     = useRef<HTMLCanvasElement>(null);
  const yDrawRef  = useRef<Float32Array>(new Float32Array(0));
  const animRef   = useRef<number>(0);
  const lastTRef  = useRef<number>(0);
  const seededRef = useRef(false);
  // Cached offscreen canvas for the static background grid
  const bgRef     = useRef<{ canvas: HTMLCanvasElement; w: number; h: number; dark: boolean } | null>(null);

  useEffect(() => {
    const cv = cvRef.current;
    if (!cv) return;
    let alive = true;

    const sync = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = cv.offsetWidth, h = cv.offsetHeight;
      if (!w || !h) return;
      cv.width  = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
      seededRef.current = false;
      bgRef.current = null; // force bg rebuild on next frame
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(cv);

    const tick = (now: number) => {
      if (!alive) return;
      const ctx = cv.getContext("2d");
      if (!ctx) { animRef.current = requestAnimationFrame(tick); return; }

      const dpr = window.devicePixelRatio || 1;
      const W = cv.width / dpr, H = cv.height / dpr;
      if (!W || !H) { animRef.current = requestAnimationFrame(tick); return; }

      const dt = lastTRef.current === 0 ? 16 : Math.min(now - lastTRef.current, 50);
      lastTRef.current = now;

      const nLines = Math.ceil(W / SPACING) + 4;

      // Spread tips uniformly across the full travel cycle on first seed
      if (!seededRef.current || yDrawRef.current.length !== nLines) {
        seededRef.current = true;
        yDrawRef.current = new Float32Array(nLines);
        for (let i = 0; i < nLines; i++) {
          yDrawRef.current[i] = -TAIL + Math.random() * (H + 2 * TAIL);
        }
      }

      const ys = yDrawRef.current;

      // Advance tips; wrap only after the tail has fully exited the bottom
      for (let i = 0; i < nLines; i++) {
        const mult = 0.65 + 0.70 * (Math.sin(i * 1.6180) * 0.5 + 0.5);
        ys[i] += SPEED * mult * dt;
        if (ys[i] > H + TAIL) ys[i] -= (H + 2 * TAIL);
      }

      // ── Offscreen background ─────────────────────────────────────────────
      // The background grid is static — rebuild only on resize or theme change.
      const dark = document.documentElement.getAttribute("data-theme") === "dark";
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
          const phase = i % 2 === 0 ? 0 : Math.PI;
          const cx    = (i - 1.5) * SPACING;
          // Start 1px above canvas boundary: the butt cap is clipped at y=0,
          // producing a clean horizontal edge rather than an angled cut.
          bc.beginPath();
          bc.moveTo(cx + SWELL * Math.sin(2 * Math.PI * (-1) / PERIOD + phase), -1);
          for (let y = 4; y <= H; y += 5) {
            bc.lineTo(cx + SWELL * Math.sin(2 * Math.PI * y / PERIOD + phase), y);
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

      // Layer 1: blit pre-rendered background (single draw call, no paths)
      ctx.drawImage(bg.canvas, 0, 0, W, H);

      // Layer 2: animated tips with fading gradient trails
      const [r, g, b] = dark ? [180, 178, 170] : [80, 78, 72];
      ctx.lineWidth = LW_TIP;
      ctx.lineCap   = "butt";

      for (let i = 0; i < nLines; i++) {
        const yDraw = ys[i];
        const phase = i % 2 === 0 ? 0 : Math.PI;
        const cx    = (i - 1.5) * SPACING;

        // Freeze tip at the bottom edge once it exits; fade the whole trail
        // uniformly so it dissolves in place rather than glowing at the edge.
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

        // When the trail starts at the canvas top (vTop=0), begin 1px above
        // so the butt cap is clipped cleanly rather than cut at an angle.
        const pathY0 = vTop > 0 ? vTop : -1;
        ctx.beginPath();
        ctx.moveTo(cx + SWELL * Math.sin(2 * Math.PI * pathY0 / PERIOD + phase), pathY0);
        for (let y = pathY0 + 4; y <= vBot; y += 4) {
          ctx.lineTo(cx + SWELL * Math.sin(2 * Math.PI * y / PERIOD + phase), y);
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
    };
  }, []);

  return (
    <canvas
      ref={cvRef}
      style={{ width: "100%", height: "100%", display: "block" }}
    />
  );
}
