"use client";

import { useRef, useEffect } from "react";

const N    = 360;    // particle count
const SPD  = 0.65;   // base logical px per frame
const FADE = 0.012;  // per-frame background fade alpha

// Iron-glazed surface — dark mode
const DARK  = { br: 13,  bg: 10,  bb: 8,   rr: 216, rg: 211, rb: 197, ur: 30,  ug: 77,  ub: 107 };
// White-slip surface — light mode
const LIGHT = { br: 236, bg: 232, bb: 222, rr: 26,  rg: 12,  rb: 6,   ur: 58,  ug: 110, ub: 136 };

interface Pt {
  x: number; y: number;
  px: number; py: number;
  life: number; max: number;
  spd: number; blue: boolean; op: number;
}

function newPt(W: number, H: number, idx: number, scatter = false): Pt {
  const x = Math.random() * W;
  const y = scatter              ? Math.random() * H
          : Math.random() < 0.65 ? Math.random() * H * 0.3
          : Math.random() * H;
  const m = 100 + Math.floor(Math.random() * 200);
  return {
    x, y, px: x, py: y,
    life: scatter ? Math.floor(Math.random() * m) : m,
    max: m,
    spd: SPD * (0.7 + Math.random() * 0.6),
    blue: (idx * 7 + 3) % 19 < 3,
    op: 0.05 + Math.random() * 0.09,
  };
}

function flowField(x: number, y: number, W: number, H: number, t: number): number {
  const nx = x / W, ny = y / H;
  return Math.PI / 2 + (
    Math.sin(nx * 4.1 + t * 0.0068) * 0.52 +
    Math.cos(ny * 3.3 + nx * 2.1 + t * 0.0089) * 0.44 +
    Math.sin(nx * 7.2 + ny * 2.9 + t * 0.0051) * 0.27 +
    Math.cos((nx - ny) * 4.1     + t * 0.0037) * 0.19
  ) * 0.72;
}

export default function WaveformLayers() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef  = useRef({ nx: 0.5, ny: 0.5, on: false });
  const frameRef  = useRef(0);
  const animRef   = useRef<number>(0);
  const ptsRef    = useRef<Pt[]>([]);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    let alive = true;

    function syncSize() {
      const dpr = window.devicePixelRatio || 1;
      const w = cv.offsetWidth, h = cv.offsetHeight;
      if (!w || !h) return;
      cv.width  = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
      const ctx = cv.getContext("2d");
      if (!ctx) return;
      const dark = document.documentElement.getAttribute("data-theme") === "dark";
      const c = dark ? DARK : LIGHT;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = `rgb(${c.br},${c.bg},${c.bb})`;
      ctx.fillRect(0, 0, w, h);
    }
    syncSize();
    const ro = new ResizeObserver(syncSize);
    ro.observe(cv);

    function onMove(e: MouseEvent) {
      const r = cv.getBoundingClientRect();
      mouseRef.current = {
        nx: (e.clientX - r.left) / r.width,
        ny: (e.clientY - r.top)  / r.height,
        on: true,
      };
    }
    function onLeave() { mouseRef.current.on = false; }
    cv.addEventListener("mousemove", onMove);
    cv.addEventListener("mouseleave", onLeave);

    const dpr0 = window.devicePixelRatio || 1;
    const W0 = cv.width / dpr0, H0 = cv.height / dpr0;
    if (W0 > 0 && H0 > 0) {
      ptsRef.current = Array.from({ length: N }, (_, i) => newPt(W0, H0, i, true));
    }

    function draw() {
      if (!alive) return;
      const ctx = cv.getContext("2d");
      if (!ctx) return;
      const dpr = window.devicePixelRatio || 1;
      const W = cv.width / dpr, H = cv.height / dpr;
      if (!W || !H) { animRef.current = requestAnimationFrame(draw); return; }

      const t = frameRef.current;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const dark = document.documentElement.getAttribute("data-theme") === "dark";
      const c = dark ? DARK : LIGHT;

      if (ptsRef.current.length === 0) {
        ptsRef.current = Array.from({ length: N }, (_, i) => newPt(W, H, i, true));
      }

      // Slow fade: trails persist and gradually decay
      ctx.fillStyle = `rgba(${c.br},${c.bg},${c.bb},${FADE})`;
      ctx.fillRect(0, 0, W, H);

      const { nx: mnx, ny: mny, on } = mouseRef.current;
      ctx.lineCap = "round";

      const pts = ptsRef.current;
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        p.life -= 1;
        if (p.life <= 0) { pts[i] = newPt(W, H, i); continue; }

        p.px = p.x; p.py = p.y;

        let fa = flowField(p.x, p.y, W, H, t);
        if (on) {
          const dx = p.x / W - mnx, dy = p.y / H - mny;
          const g  = Math.exp(-(dx * dx + dy * dy) / 0.025);
          // Vortex: tangential push that swirls particles around the cursor
          fa += g * 0.85 * Math.sin(Math.atan2(dy, dx) + Math.PI / 2 - fa);
        }

        p.x += Math.cos(fa) * p.spd;
        p.y += Math.sin(fa) * p.spd;

        if (p.x < -12 || p.x > W + 12 || p.y < -12 || p.y > H + 20) {
          pts[i] = newPt(W, H, i); continue;
        }

        const fi = Math.min(1, (1 - p.life / p.max) * 8);
        const fo = Math.min(1, (p.life  / p.max) * 6);
        const al = p.op * fi * fo;
        if (al < 0.004) continue;

        ctx.strokeStyle = p.blue
          ? `rgba(${c.ur},${c.ug},${c.ub},${Math.min(1, al * 1.5)})`
          : `rgba(${c.rr},${c.rg},${c.rb},${al})`;
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.moveTo(p.px, p.py);
        ctx.lineTo(p.x, p.y);
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
      cv.removeEventListener("mousemove", onMove);
      cv.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  return <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />;
}
