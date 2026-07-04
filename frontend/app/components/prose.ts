// Descendant-utility prose styling shared by the static text pages (/privacy,
// /terms via LegalPage, and /docs). Page bodies stay plain h2/h3/p/ul/table
// markup; this container styles them. h3 and code rules exist for /docs and
// are harmless on the legal pages.
export const PROSE_CLASSES = `text-[15px] leading-7 text-foreground
  [&_a]:text-accent [&_a]:underline
  [&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-foreground
  [&_h3]:mt-8 [&_h3]:mb-2 [&_h3]:font-display [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-foreground
  [&_p]:mb-4
  [&_ul]:mb-4 [&_ul]:ml-5 [&_ul]:list-disc
  [&_ol]:mb-4 [&_ol]:ml-5 [&_ol]:list-decimal
  [&_li]:mb-1.5
  [&_strong]:font-semibold
  [&_code]:font-mono [&_code]:text-[13px]
  [&_table]:my-5 [&_table]:w-full [&_table]:border-collapse
  [&_th]:border-b [&_th]:border-surface-border [&_th]:py-2 [&_th]:pr-4 [&_th]:text-left [&_th]:text-sm [&_th]:font-semibold
  [&_td]:border-b [&_td]:border-surface-border [&_td]:py-2 [&_td]:pr-4 [&_td]:align-top [&_td]:text-sm [&_td]:text-muted`;
