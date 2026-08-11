/* The config panel's type ramp, in one place.

   Pure — no React import — so vitest's `node` environment can load it, the same
   split ledger-geometry.ts and card-geometry.ts make.

   Three steps replace the five competing label idioms the panel carried after
   the section-strip rebuild (7 sites at 11px medium, 6 at 10px semibold muted,
   1 at 13px semibold, plus two more muted variants). ModelPicker was the only
   consumer of the 13px step, which is the whole of why the model section looked
   like a different app.

   This retires the 10px-semibold-muted tier that ui-harmonization.md rule 4
   established. Rule 4 was about removing *uppercase* — it kept the old size and
   colour untouched, so the faded look was inherited from the pre-card design
   rather than chosen. Amending that rule is part of this change (Task 9).

   Panel only. The cards' own eyebrows are the verified surface and keep theirs. */

/** Names a block inside a section body. Sparing — most sections have one. */
export const PANEL_HEADING = "text-[11px] leading-[18px] font-semibold text-foreground";

/** Names a single control. The workhorse step. */
export const PANEL_LABEL = "text-[11px] leading-[14px] font-medium text-foreground";

/** Secondary content. */
export const PANEL_META = "text-[10px] leading-[13px] font-normal text-muted";
