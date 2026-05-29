"use client";

import { useRef, useEffect } from "react";

// ─── Types ──────────────────────────────────────────────────────────────────

interface LNode { x: number; y: number }

interface LEdge {
  a: number; b: number;
  midX: number; midY: number;
  angle: number;   // radians, normalised to [0, π)
  length: number;
  strip: number;   // visual weight character [0.5, 1.4]
}

interface LFace {
  a: number; b: number; c: number;
  eAB: number; eBC: number; eCA: number;
}

interface Lattice {
  nodes: LNode[];
  edges: LEdge[];
  faces: LFace[];
}

interface Wave {
  activateTimes: number[];  // per-edge, ms from startT
  nodeTimes:     number[];  // per-node, ms from startT
  startT:        number;    // performance.now() timestamp
  grain:         number;    // preferred propagation direction, radians
}

// ─── Constants ──────────────────────────────────────────────────────────────

const SP      = 40;                    // px between grid nodes
const JIT     = SP * 0.15;            // organic displacement amplitude
const PERIOD  = 13_000;               // ms per wave cycle
const N_WAVES = 3;                    // simultaneous illumination waves
const STAGGER = 3_800;               // ms between wave starts
const MPX     = 17;                   // ms per pixel base propagation speed
const GRAIN_B = 0.50;                // grain-direction speed bias
const PEAK_A  = 0.72;
const DIM_A   = 0.028;
const FACE_A  = 0.055;               // face fill peak alpha
const FADE    = 2_800;               // ms baseline fade

// 組子 — warm cedar / paulownia tones
const CEDAR: [number, number, number] = [192, 154, 102];
const LIGHT: [number, number, number] = [224, 195, 148];

// ─── Lattice ────────────────────────────────────────────────────────────────

function buildLattice(W: number, H: number): Lattice {
  const dx = SP;
  const dy = SP * (Math.sqrt(3) / 2);
  const cols = Math.ceil(W / dx) + 4;
  const rows = Math.ceil(H / dy) + 4;

  const nodes: LNode[] = [];
  const grid: number[][] = [];

  for (let r = 0; r < rows; r++) {
    grid.push([]);
    for (let c = 0; c < cols; c++) {
      // Sine-based displacement — consistent, smooth, never random — gives a
      // hand-planed quality without the noise of seeded randomness.
      const jx = Math.sin(r * 1.471 + c * 2.193) * JIT;
      const jy = Math.cos(r * 2.037 + c * 0.779) * JIT;
      grid[r].push(nodes.length);
      nodes.push({
        x: (c - 1) * dx + (r % 2 === 0 ? 0 : dx / 2) + jx,
        y: (r - 1) * dy + jy,
      });
    }
  }

  // ── Edges ──────────────────────────────────────────────────────────────
  const edges: LEdge[] = [];
  const seen = new Set<string>();

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      // Three forward-facing neighbors cover all edges once in a triangular grid.
      // Odd rows shift by dx/2, changing which diagonal neighbor is "forward-left."
      const nbrs: [number, number][] =
        r % 2 === 0
          ? [[r, c + 1], [r + 1, c], [r + 1, c - 1]]
          : [[r, c + 1], [r + 1, c], [r + 1, c + 1]];

      for (const [nr, nc] of nbrs) {
        if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
        const ai = grid[r][c], bi = grid[nr][nc];
        const key = `${ai}-${bi}`;
        if (seen.has(key)) continue;
        seen.add(key);

        const a = nodes[ai], b = nodes[bi];
        const ex = b.x - a.x, ey = b.y - a.y;
        const len = Math.sqrt(ex * ex + ey * ey);
        let angle = Math.atan2(ey, ex);
        if (angle < 0) angle += Math.PI;

        // Edges near the three kumiko grain angles (0°, 60°, 120°) are the
        // primary structural strips — they get a heavier visual weight.
        const grains = [0, Math.PI / 3, (2 * Math.PI) / 3];
        const minDelta = Math.min(...grains.map(g =>
          Math.min(Math.abs(angle - g), Math.PI - Math.abs(angle - g)),
        ));
        const strip = 0.55 + (1 - Math.min(1, minDelta / (Math.PI / 6))) * 0.85;

        edges.push({
          a: ai, b: bi,
          midX: (a.x + b.x) / 2,
          midY: (a.y + b.y) / 2,
          angle, length: len, strip,
        });
      }
    }
  }

  // ── Faces (triangular cells = the "pixels") ────────────────────────────
  const adjM: Map<number, number>[] = Array.from({ length: nodes.length }, () => new Map());
  for (let i = 0; i < edges.length; i++) {
    adjM[edges[i].a].set(edges[i].b, i);
    adjM[edges[i].b].set(edges[i].a, i);
  }

  const faces: LFace[] = [];
  const fseen = new Set<string>();
  for (let a = 0; a < nodes.length; a++) {
    for (const [b, eAB] of adjM[a]) {
      if (b <= a) continue;
      for (const [c, eBC] of adjM[b]) {
        if (c <= b) continue;
        const eCA = adjM[c].get(a);
        if (eCA === undefined) continue;
        const fk = `${a}-${b}-${c}`;
        if (fseen.has(fk)) continue;
        fseen.add(fk);
        faces.push({ a, b, c, eAB, eBC, eCA });
      }
    }
  }

  return { nodes, edges, faces };
}

// ─── Dijkstra ───────────────────────────────────────────────────────────────

function dijkstra(edges: LEdge[], N: number, src: number, grain: number): number[] {
  const dist = new Array<number>(N).fill(Infinity);
  dist[src] = 0;
  const vis = new Set<number>();

  const adj: { v: number; ei: number }[][] = Array.from({ length: N }, () => []);
  for (let i = 0; i < edges.length; i++) {
    adj[edges[i].a].push({ v: edges[i].b, ei: i });
    adj[edges[i].b].push({ v: edges[i].a, ei: i });
  }

  for (;;) {
    let u = -1, minD = Infinity;
    for (let i = 0; i < N; i++) if (!vis.has(i) && dist[i] < minD) { minD = dist[i]; u = i; }
    if (u === -1) break;
    vis.add(u);
    for (const { v, ei } of adj[u]) {
      if (vis.has(v)) continue;
      const e = edges[ei];
      // cos(2 * angle_diff) ∈ [-1, 1]: grain-aligned edges propagate faster,
      // perpendicular edges slower — produces the directional strip-sweep look.
      const align = Math.cos((e.angle - grain) * 2);
      const cost  = e.length * MPX * (1 - GRAIN_B * align);
      if (dist[u] + cost < dist[v]) dist[v] = dist[u] + cost;
    }
  }
  return dist;
}

// ─── Wave Planner ───────────────────────────────────────────────────────────

function planWave(lat: Lattice, W: number, H: number, idx: number): Omit<Wave, "startT"> {
  const { nodes, edges } = lat;
  const N = nodes.length;

  // Each wave prefers a different kumiko grain direction (0°, 60°, 120°).
  const grain = (idx * Math.PI) / 3;

  // Origin quadrant mirrors grain direction so the illumination sweeps
  // along the strips it prefers — left for horizontal, bottom for 60°, right for 120°.
  const oBase: [number, number] =
    idx === 0
      ? [W * (0.04 + Math.random() * 0.14), H * (0.15 + Math.random() * 0.70)]
      : idx === 1
      ? [W * (0.30 + Math.random() * 0.40), H * (0.65 + Math.random() * 0.30)]
      : [W * (0.80 + Math.random() * 0.16), H * (0.15 + Math.random() * 0.70)];

  // Wave 1 gets a second origin to create interference with itself.
  const origs: [number, number][] = [oBase];
  if (idx === 1) {
    origs.push([W * (0.10 + Math.random() * 0.30), H * (0.08 + Math.random() * 0.45)]);
  }

  const activateTimes = new Array<number>(edges.length).fill(Infinity);
  for (const [tx, ty] of origs) {
    let best = 0, bestD = Infinity;
    for (let i = 0; i < N; i++) {
      const d = (nodes[i].x - tx) ** 2 + (nodes[i].y - ty) ** 2;
      if (d < bestD) { bestD = d; best = i; }
    }
    const nd = dijkstra(edges, N, best, grain);
    for (let i = 0; i < edges.length; i++) {
      const t = Math.min(
        isFinite(nd[edges[i].a]) ? nd[edges[i].a] : Infinity,
        isFinite(nd[edges[i].b]) ? nd[edges[i].b] : Infinity,
      );
      if (t < activateTimes[i]) activateTimes[i] = t;
    }
  }

  // Normalise: last activation lands at ≤55% of PERIOD so long fades can
  // complete before the next wave begins.
  const finite = activateTimes.filter(isFinite);
  if (finite.length > 0) {
    const maxT  = Math.max(...finite);
    const scale = maxT > 0 ? (PERIOD * 0.55) / maxT : 1;
    for (let i = 0; i < activateTimes.length; i++)
      if (isFinite(activateTimes[i])) activateTimes[i] *= scale;
  }
  for (let i = 0; i < activateTimes.length; i++)
    if (!isFinite(activateTimes[i])) activateTimes[i] = PERIOD + 99_999;

  // Node times = earliest adjacent edge
  const nodeTimes = new Array<number>(N).fill(Infinity);
  for (let i = 0; i < edges.length; i++) {
    const t = activateTimes[i];
    if (t < nodeTimes[edges[i].a]) nodeTimes[edges[i].a] = t;
    if (t < nodeTimes[edges[i].b]) nodeTimes[edges[i].b] = t;
  }

  return { activateTimes, nodeTimes, grain };
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function WaveformLayers() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const latRef    = useRef<Lattice | null>(null);
  const wavesRef  = useRef<Wave[]>([]);
  const animRef   = useRef<number>(0);

  useEffect(() => {
    const cv = canvasRef.current as HTMLCanvasElement;
    if (!cv) return;
    let alive = true;

    function rebuild(W: number, H: number) {
      latRef.current   = buildLattice(W, H);
      wavesRef.current = [];
    }

    function syncSize() {
      const dpr = window.devicePixelRatio || 1;
      const w = cv.offsetWidth, h = cv.offsetHeight;
      if (!w || !h) return;
      cv.width  = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
      rebuild(w, h);
    }

    syncSize();
    const ro = new ResizeObserver(syncSize);
    ro.observe(cv);

    function draw(now: number) {
      if (!alive) return;
      const ctx = cv.getContext("2d");
      const lat = latRef.current;
      if (!ctx || !lat) { animRef.current = requestAnimationFrame(draw); return; }

      const dpr = window.devicePixelRatio || 1;
      const W = cv.width / dpr, H = cv.height / dpr;
      if (!W || !H) { animRef.current = requestAnimationFrame(draw); return; }

      const { nodes, edges, faces } = lat;

      // Initialise three waves on first frame
      if (wavesRef.current.length === 0) {
        for (let i = 0; i < N_WAVES; i++) {
          const plan = planWave(lat, W, H, i);
          wavesRef.current.push({ ...plan, startT: now + i * STAGGER });
        }
      }

      // Recycle each wave independently; startT advances by exactly PERIOD
      // so timing stays coherent across replan cycles.
      const waves = wavesRef.current;
      for (let i = 0; i < waves.length; i++) {
        if (now - waves[i].startT >= PERIOD) {
          const plan = planWave(lat, W, H, i);
          waves[i] = { ...plan, startT: waves[i].startT + PERIOD };
        }
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);

      const dark = document.documentElement.getAttribute("data-theme") === "dark";
      const [tr, tg, tb] = dark ? [212, 210, 203] : [28, 28, 28];
      const [cr, cg, cb] = CEDAR;
      const [lr, lg, lb] = LIGHT;

      ctx.save();
      ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();

      // ── Per-edge activation fraction (max across all waves) ───────────
      const fracE = new Float32Array(edges.length);
      for (const w of waves) {
        const el = now - w.startT;
        if (el < 0) continue;
        for (let i = 0; i < edges.length; i++) {
          const dt  = el - w.activateTimes[i];
          const dur = FADE * (0.75 + edges[i].strip * 0.45);
          let f = 0;
          if      (dt > 0   && dt <  120) f = dt / 120;
          else if (dt >= 120 && dt <  280) f = 1;
          else if (dt >= 280)              f = Math.max(0, 1 - (dt - 280) / dur);
          if (f > fracE[i]) fracE[i] = f;
        }
      }

      // Per-node fraction = max of adjacent edges
      const fracN = new Float32Array(nodes.length);
      for (let i = 0; i < edges.length; i++) {
        if (fracE[i] > fracN[edges[i].a]) fracN[edges[i].a] = fracE[i];
        if (fracE[i] > fracN[edges[i].b]) fracN[edges[i].b] = fracE[i];
      }

      // ── Face fills — triangular cells as subtle "pixels" ──────────────
      const fpk = dark ? FACE_A : FACE_A * 0.65;
      for (const f of faces) {
        const frac = Math.max(fracE[f.eAB], fracE[f.eBC], fracE[f.eCA]);
        if (frac < 0.02) continue;
        const fa = fpk * frac;
        const r = Math.round(tr + (cr - tr) * frac);
        const g = Math.round(tg + (cg - tg) * frac);
        const b = Math.round(tb + (cb - tb) * frac);
        ctx.fillStyle = `rgba(${r},${g},${b},${fa.toFixed(3)})`;
        ctx.beginPath();
        ctx.moveTo(nodes[f.a].x, nodes[f.a].y);
        ctx.lineTo(nodes[f.b].x, nodes[f.b].y);
        ctx.lineTo(nodes[f.c].x, nodes[f.c].y);
        ctx.closePath();
        ctx.fill();
      }

      // ── Edges — variable-weight strips ───────────────────────────────
      ctx.lineCap = "round";
      for (let i = 0; i < edges.length; i++) {
        const frac  = fracE[i];
        const e     = edges[i];
        const alpha = DIM_A + (PEAK_A - DIM_A) * frac;
        const r = Math.round(tr + (lr - tr) * frac);
        const g = Math.round(tg + (lg - tg) * frac);
        const b = Math.round(tb + (lb - tb) * frac);
        ctx.strokeStyle = `rgba(${r},${g},${b},${alpha.toFixed(3)})`;
        ctx.lineWidth   = e.strip * (0.55 + 0.72 * frac);
        ctx.beginPath();
        ctx.moveTo(nodes[e.a].x, nodes[e.a].y);
        ctx.lineTo(nodes[e.b].x, nodes[e.b].y);
        ctx.stroke();
      }

      // ── Intersection joints — small dots that brighten at junctions ───
      for (let i = 0; i < nodes.length; i++) {
        const frac = fracN[i];
        if (frac < 0.06) continue;
        const { x, y } = nodes[i];
        const dotA = (dark ? 0.38 : 0.28) * frac;
        const r = Math.round(tr + (lr - tr) * frac);
        const g = Math.round(tg + (lg - tg) * frac);
        const b = Math.round(tb + (lb - tb) * frac);
        ctx.fillStyle = `rgba(${r},${g},${b},${dotA.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(x, y, 0.9 + 0.8 * frac, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
      animRef.current = requestAnimationFrame(draw);
    }

    animRef.current = requestAnimationFrame(draw);
    return () => {
      alive = false;
      cancelAnimationFrame(animRef.current);
      ro.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: "100%", height: "100%", display: "block" }}
    />
  );
}
