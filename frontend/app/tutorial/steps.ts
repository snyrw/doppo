export type TutorialLink = {
  label: string;
  url: string;
};

export type TutorialStep = {
  cardType: "logit-lens" | "attention-pattern" | "dla" | "attribution" | "activation" | "steering";
  heading: string;
  paragraphs: (string | { type: "image"; src: string; alt: string })[];
  whatToNotice?: string;
  caveat?: string;
  links: TutorialLink[];
};
