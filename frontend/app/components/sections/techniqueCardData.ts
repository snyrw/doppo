// Content for the five technique cards that open as modals from the Techniques
// section (Figma nodes 134-2/3/5/6/7). Indexed parallel to TECHNIQUES in
// `techniqueBars.ts`: 0 logit lens, 1 attention, 2 DLA, 3 patching, 4 steering.
//
// `title` is the muted breadcrumb title in each card header. `copy` is the
// right-column explainer. Cards 0–2 are transcribed verbatim from Figma; cards 3
// (patching) and 4 (steering) inherited the wrong DLA text in Figma, so their
// copy is rewritten here to actually describe the technique.
export interface TechniqueCardContent {
  title: string;
  copy: string;
}

export const TECHNIQUE_CARDS: readonly TechniqueCardContent[] = [
  {
    title: "Logit Lens",
    copy: "Transformers apply an unembedding matrix to turn logits into tokens that turn into human-readable output. The logit lens simply applies the unembedding matrix at every single layer to see how “predictions” change.",
  },
  {
    title: "Attention Analysis",
    copy: "An attention head graph shows which earlier tokens each token is paying attention to when the model processes text. Darker or larger connections mean the model is relying more on those tokens for context, helping reveal patterns like matching names, tracking sentence structure, or referring back to previous words.",
  },
  {
    title: "Direct Logit Att.",
    copy: "Direct Logit Attribution shows which model components (such as attention heads or neurons) are most responsible for increasing or decreasing the score of a particular predicted token. Positive values push the model toward that prediction, while negative values push it away, making it easier to see where the model's final decision came from.",
  },
  {
    title: "Patching",
    copy: "Activation patching copies one component's activation from a clean run into a corrupted run, then measures how far the output snaps back toward the clean prediction. The dark bar is the effect attribution predicts a component has; the light bar is what patching it in actually does — comparing the two shows which parts of the model genuinely carry the behavior.",
  },
  {
    title: "Steering",
    copy: "Steering adds a direction to the model's residual stream at inference time to bend its behavior — here, nudging English answers into French. The direction is the difference in means between contrasting prompt pairs, and an alpha controls how hard it pushes. Same question and base answer, steered into a new language.",
  },
] as const;

// The three steering examples the SteeringFigure cycles through, in order
// (library → Gollum → Seattle). Base answers are English; steered answers are the
// same content nudged into French — the visible payoff of the steering vector.
export interface SteeringExample {
  question: string;
  base: string;
  steered: string;
}

export const STEERING_EXAMPLES: readonly SteeringExample[] = [
  {
    question: "Where is the library?",
    base: "The library is on Main Street.",
    steered: "La bibliothèque est dans la rue principale.",
  },
  {
    question: "Have you seen my precious?",
    base: "Sorry, Gollum. I haven't seen your ring.",
    steered: "Désolé, Gollum. Je n'ai pas vu ton anneau.",
  },
  {
    question: "What's the best band in Seattle?",
    base: "Many tend to say that ‘Lawn Darts’ might take that title soon.",
    steered: "Beaucoup pensent que « Lawn Darts » pourrait bientôt remporter ce titre.",
  },
] as const;
