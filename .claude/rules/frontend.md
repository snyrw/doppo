# Frontend patterns

## Sandbox card types

Seven types: `"logit-lens"` (`LensCardData`), `"dla"` (`DlaCardData`), `"attribution"` (`AttributionCardData`), `"activation"` (`ActivationCardData`), `"steering"` (`SteeringCardData`), `"entropy"` (`EntropyCardData`), `"attention-pattern"` (`AttentionCardData`). Full union is `AnyCard` exported from `SandboxCanvas.tsx`.

- `AttributionCardData` uses `cleanPrompt` / `corruptedPrompt` — not a single `prompt`. Use `getCardPrompt(card)` in `projects/helpers.ts` for generic prompt access.
- `EntropyCardData` is spawned from a LensCard (child card); always has `status: "result"` and `parentLensId`. Never goes through a loading state.
- `AttentionCardData` uses cardType `"attention-pattern"` (not `"attn"`). Has `data: AttentionData | null` with shape `{ tokens, patterns[layer][head][q][k], n_layers, n_heads, truncated }`.
- `SteeringCardData` carries `nPairs` (defaults to 1 for old DB rows); always set explicitly on new cards.
- Attribution payload includes `target_token` (string) and `target_token_idx` (int) — activation patch requires the integer.
- `SerializedCard.data` in `actions.ts` is `Record<string, unknown>` — cast through `unknown` when restoring typed card data from DB.
- When restoring cards from DB: discriminate on `cardType` and cast explicitly. Add `?? default` for every new field for backward compat with old rows.
- Card serialization lives in `serializeCard()` in `projects/helpers.ts` — one branch per card type. Add a branch when adding a new card type.

## Canvas interaction invariants

`useCanvasPan` fires on any left-click on the canvas viewport. Pan is blocked only by `e.stopPropagation()` on `onPointerDown`. Every interactive element inside a card — drag handle, buttons, toggles, clickable cells — **must** call `e.stopPropagation()` on `onPointerDown`.

`renderCard()` in `SandboxCanvas` passes `sharedProps` without `key`. Place `key={card.id}` directly on each JSX element — spreading `key` via props is a React error.

`overflow: auto` containers inside cards need explicit `background: "var(--color-card)"` — some browsers paint a white layer independent of the parent.

## ConfigPane

Model selection is shared: `useModelSelection()` in `app/hooks/useModelSelection.ts` (state machine) + `<ModelPicker>` in `app/components/ModelPicker.tsx` (UI), used by all five panes. Two mutually exclusive modes: featured model card grid (from `/api/models`) and free-text HuggingFace ID input. Clicking a card clears the text input; typing clears the card selection. Custom IDs require an explicit "Validate" step before "Run" enables. `/api/validate-model` returns `{valid, gpu_tier, reason}`; the success label shows `gpu_tier`. Tutorial pre-fill: `picker.forceModel(name)` for featured models, `picker.forceCustomModel(repoId, tier)` for non-featured (steering uses the latter).

## Auth patterns

Client: `const { data: session } = useSession()` from `lib/auth-client`.

Server (routes and server actions):
```ts
import { headers } from "next/headers";
import { auth } from "./lib/auth";
const session = await auth.api.getSession({ headers: await headers() });
if (!session?.user) throw new Error("Unauthorized");
```

## Heatmap caching

All inference cache keys are user-scoped: SHA-256 of `userId:modelName:prompt[:extra_dims]`. Hits served from R2; misses call Modal then write to R2 + cache table row.

DLA and attribution cache lookups use `eq(table.id, cacheKey)` only — not a multi-field WHERE clause. The hash already encodes all dimensions; this avoids schema migrations when new cache fields are added.

Cache tables: `heatmap_cache`, `dla_cache`, `attribution_cache`, `steeringCache`, `activationPatchCache`, `attnCache`.

## Steering / DIM vectors

`run_steering` accumulates per-component difference-in-means vectors across all pairs, then normalizes: `avg_v / (avg_v.norm() + 1e-8)`. Seed pair (primary `clean_prompt`/`corrupted_prompt`) counts as pair 1; `extra_pairs` appended. Generate `cap - 1` extras so total = cap.

**DIM extraction position:** use `cp_pos = clean_len - 1` and `rp_pos = corrupted_len - 1` independently. Never use `min_len - 1` — it pulls mid-sequence from the longer prompt. LLM-generated pairs routinely tokenize to different lengths.

**Tier pair caps** — single source: `TIER_PAIR_CAPS` / `DEFAULT_PAIR_CAP` in `app/lib/tiers.ts`, imported by both `generate-pairs/route.ts` and `SteeringConfigPane.tsx`:
- `tl_small`=40, `tl_medium`=25, `tl_large`=15, `tl_xlarge`=10, `tl_xxlarge`=10

Generation uses temperature sampling + repetition penalty (HF-style: divide positive logits, multiply negative for already-generated tokens). `temperature <= 0` gives argmax.

## Spawn + poll job lifecycle

All inference cards go through `runJob()` in `projects/hooks/job-runner.ts`: POST the spawn route → if `{ status: "cached", data }` resolve immediately → else poll `GET /api/job/{jobId}` every 5s until `done`/`error`. A lost poll connection fires a best-effort `DELETE /api/job/{jobId}` cancel. Loading-stage text is heuristic (elapsed-time based), not server-driven. The Next.js spawn routes are all built by `createSpawnHandler()` in `app/lib/spawn-route.ts` — add new job types there, not by copying a route.

On resolve, cards dispatch the shared `CARD_RESOLVED` action (discriminated on `cardType`) and persist via `serializeCard({ ...card, status: "result", data })` — never hand-roll the serialized shape. Auto-save (`updateProject`) uses `projectIdRef` + `stateRef` (synced via `useEffect`) to avoid stale closures inside the async callback; the just-resolved card is appended explicitly because `stateRef` lags the dispatch.

## Projects feature

- **New** — creates row with empty `cards: []`; cards only persisted by explicit `updateProject` calls
- **Duplicate** — serializes only `status: "result"` cards; skips loading/error
- **Search** — `ProjectSearch` triggered by Cmd+K; fetches full `cards` jsonb on open (can be heavy)
- **Share** — `setProjectShare(projectId)` generates stable `shareId` UUID + sets `isPublic = true`; public view at `/share/[shareId]`
- Use `router.replace()` not `router.push()` for project navigation

## html-to-image

Two required workarounds for per-card PNG export:
1. **Blank image in CSS-transformed parent** — Fix: `toPng(el, { pixelRatio: 3, width: el.offsetWidth, height: el.offsetHeight, style: { position: "relative", left: "0", top: "0" } })`
2. **SSR** — never import at module level; use `const { toPng } = await import("html-to-image")` inside the handler

## Styling

**Tailwind v4 + tokens.** Styling is Tailwind utility classes. The runtime CSS vars (in `globals.css`, toggled by `[data-theme="dark"]` on `<html>`) are mapped into Tailwind's theme via an `@theme inline` block, so every token has a utility:
- runtime vars: `--bg/panel/card/card-border/surface-border`, `--text/text-muted`, `--accent/accent-hover/accent-fg` (note: renamed from `--color-*` — the `--color-*` namespace now belongs to Tailwind's `@theme`)
- utilities: `bg-background` (`--bg`), `bg-panel`, `bg-card`, `border-card-border`, `border-surface-border`, `text-foreground` (`--text`), `text-muted`, `bg-accent`/`hover:bg-accent-hover`/`text-accent-fg`. Fonts: `font-sans`. Animations: `animate-spinner`, `animate-cfg-drop-in`, `animate-fade-up`, `animate-fade-in`.
- `--heatmap-rgb` — **only valid for `warm-mono`**. For all other palettes use `interpolateColor(palette, prob)` from `app/lib/palette.ts`

**New code uses Tailwind for static styling; inline `style={{}}` only for computed values** — data-driven colors (`interpolateColor`/`interpolateColorDivergent`/`getContrastColor`, `rgba(var(--heatmap-rgb)…)`), data-driven widths (`` `${prob*100}%` ``), grid geometry from JS constants (`Y_LABEL_W`, `COL_GAP`, `HEAD_CELL_SIZE`, `cellWidth`…), card `left/top/width`, and the canvas pan/zoom transform (mutated via ref in `SandboxCanvas`). Conditional styles use `cn()` from `app/lib/cn.ts` with conditional classes, **not** ternaries inside `style`.

**Shared UI primitives** in `app/components/ui/`: `ControlButton` (small in-card button; bakes in the `onPointerDown` stopPropagation canvas invariant), `SegmentedControl`, `Modal` (overlay+panel; caller supplies width via `className` — the primitive sets no width to avoid utility-merge conflicts). `CardShell` exports `TierBadge` for the GPU-tier pill used in card hover popups. Reuse these instead of re-deriving styles.

**No `tailwind-merge`** in the project — conflicting utilities (two `w-*`, `px-*` vs `px-*`, `border-0` vs `border-b`) resolve by stylesheet order, which is unreliable. Avoid emitting conflicting classes: don't set a width in a shared class a caller needs to override, and kill native borders with `border-x-0 border-t-0` + explicit `border-b` rather than `border-none` + `border-b`.

**Dark mode:** `data-theme="dark"` on `<html>` set by inline `<script>` in `layout.tsx` `<head>`; the runtime vars flip, so utilities work in both themes with **zero `dark:` variants**. Do **not** use `@custom-variant dark` — causes a silent Turbopack compile failure where stale CSS is served with no error logged.

**CSS not updating?** Kill dev server, `rm -rf .next/cache`, restart. Turbopack can silently serve stale compiled CSS on parse errors.

Layout constants: Navbar = 50px, `zIndex: 40`. `ConfigPane` uses `top: 57px`. Interactive controls: `border-radius: 6px`; cards: `12px`.

## Dropdown submenus

`overflow: hidden` on the dropdown clips `position: absolute` children. For fly-out submenus: set the dropdown to `overflow-visible` and round the items with `first:rounded-t-md last:rounded-b-md` (plus `border-b border-surface-border last:border-b-0` for dividers) instead of clipping the parent.

## LensCard header clipping

The LensCard header is `display: flex; overflow: hidden`. Two known unresolved layout issues:
1. On narrow cards, the prompt span collapses and rightmost controls are clipped with no indicator.
2. The "···" layer settings popover is `position: absolute` inside the `overflow: hidden` header — CSS clips it entirely. Fix requires moving the `position: relative` anchor to card root or lifting to portal level.

Other card types are not affected (no `overflow: hidden` on their header wrappers).

## useSearchParams requires Suspense

Any client component using `useSearchParams` must be wrapped in `<Suspense>` — missing it causes a build-time error in App Router prerendered routes.

## Tutorial mode

All seven card components and all five ConfigPane components accept `tutorialMode?: boolean`. When true:

| Component | Hidden / disabled |
|---|---|
| All cards | Remove (×) button hidden |
| `SteeringCard` | Alpha slider `disabled`; Re-run button hidden |
| `AttributionCard` | Verify button **visible** (spawns pre-computed activation card via `onVerifyTopK`); Steer buttons hidden; component-selection checkboxes `onClick` suppressed |
| `ActivationCard` | Row `onClick` suppressed; Steer N button hidden |
| `LensCard` | Entropy spawn button hidden |
| All ConfigPanes | All inputs `disabled`; fields pre-filled from `tutorialConfig` prop via `useEffect` |

Display-only controls (heatmap mode toggles, layer/head view toggles, cell hover, attention head pinning) remain interactive — users should explore visualizations freely. Card drag is also enabled.

`SandboxCanvas` accepts `tutorialMode?: boolean` and spreads it into `sharedProps`, which flows to every card. The ConfigPanes each accept a parallel `tutorialConfig` prop with pre-fill values.

**Static data pattern:** Tutorial results live in `frontend/app/tutorial/data.json` (keyed `"0"`–`"5"`). `TutorialClient.tsx` imports this at build time. When `_ready: false`, it renders a "data not yet generated" fallback. Regenerate with `python scripts/generate_tutorial_data.py` and commit the file — see the Tutorial entry in `CLAUDE.md` for script quirks.

## Landing page / deck sections (Figma → code)

`page.tsx` → `<Navbar>` + `<Deck>` + footer. Deck system in `components/deck/`:
`sections.ts` (`SECTIONS` = `{id,label,Component}[]`), `Deck.tsx` (orchestrator +
`#<id>` URL-hash deep-link via `deck-logic.ts`), `DeckContext.ts` (`useDeck()`,
`useSectionEntrance()`), `SectionShell.tsx`. Section bodies live in
`components/sections/*.tsx` and each renders `<EyebrowNav>` itself. Add a section:
append to `SECTIONS` + write the component.

Implementing a Figma mock 1:1:
- **Refactor, don't paste.** Figma's generated code is absolute-positioned
  throwaway. Rebuild with tokens + existing components (`TactileButton`,
  `EyebrowNav`, `CardShell`) and the entrance system; keep only the visual.
- **Tokens, not hex.** Grays → `--sphere-face`/`--sphere-back`; text →
  `--accent`/`--text-muted`; lines → `--surface-border`/`--card-border`. Tactile
  element = colored face over a darker shadow lip peeking out the bottom (see
  `TactileButton`).
- **Figure = container-query stage.** Each figure lives in a `max-width`-capped,
  edge-anchored column with `.figure-stage` (`container-type: inline-size`); express
  the figure's geometry in `cqi` so it scales to its column, not the viewport. Lock
  `aspect-ratio` + `min-height:0` + `overflow-hidden` (and a `max-height` cap) so it
  never overflows the fixed-height section.
- **Anchor sections to the edges, not the centerline.** Outer `md:flex md:justify-between`
  with the left copy `max-w`-capped + pinned left and the figure stage `max-w`-capped +
  pinned right; the center gap absorbs extra width on ultrawide so content stops scaling
  instead of splaying. Below `md`, sections flow vertically (continuous scroll) — see the
  deck responsive notes.
- **Entrance:** gate on `useSectionEntrance()` (replays on activation); reuse
  `animate-hero-row`/`animate-hero-word` + staggered `animationDelay`.
- **Pixel-nudge gotcha:** `translate-x-[Npx]` is overridden by an inline
  `transform` (inline style wins). For an element that already has one (e.g. a
  rotated hairline), nudge via `left-[calc(...+Npx)]` instead.
