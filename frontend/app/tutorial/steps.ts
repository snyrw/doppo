export type TutorialLink = {
  label: string;
  url: string;
};

export type TutorialStep = {
  /** Non-card content files (e.g. the welcome modal) set this instead of cardType. */
  id?: string;
  cardType: "logit-lens" | "attention-pattern" | "dla" | "attribution" | "activation" | "steering";
  heading: string;
  paragraphs: (string | { type: "image"; src: string; alt: string })[];
  whatToNotice?: string;
  caveat?: string;
  /** The paper the demo's content is built on, shown separately from `links` (general background reading). */
  paper?: TutorialLink;
  links: TutorialLink[];
  /** Secondary call-to-action shown next to the modal's primary button (e.g. "skip to projects"). */
  cta?: TutorialLink;
  /** Extra text for one card, used when a step has more than one demo card.
      Keyed by the data.json entry key (e.g. "5b"). */
  variants?: Record<string, string>;
};
