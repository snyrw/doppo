// Content for the five technique cards that open as modals from the Techniques
// section.
export interface TechniqueCardContent {
  title: string;
  copy: string;
}

export const TECHNIQUE_CARDS: readonly TechniqueCardContent[] = [
  {
    title: "Logit Lens",
    copy: "Transformers apply an unembedding matrix to turn logits into tokens that turn into human-readable output. The logit lens simply applies the unembedding matrix at every single layer to see how said output changes.",
  },
  {
    title: "Attention Analysis",
    copy: "An attention head graph shows which earlier tokens each token is paying attention to when the model processes text. Darker or larger connections mean the model is relying more on those tokens for context, helping reveal patterns like matching names, tracking sentence structure, or referring back to previous words.",
  },
  {
    title: "Direct Logit Att.",
    copy: "Direct Logit Attribution shows which model components (such as attention heads or neurons) are most responsible for increasing or decreasing the score of a particular predicted token. Positive values push the model toward that prediction, while negative values push it away.",
  },
  {
    title: "Patching",
    copy: "Activation patching copies one component's activation from a clean run into a corrupted run, then measures how far the output goes back toward the clean prediction.",
  },
  {
    title: "Steering",
    copy: "Steering adds a 'direction' to the model's residual stream to change behavior. The direction is the difference in means between contrasting prompt pairs (like English and French), and a coefficient controls what we're pushing towards.",
  },
] as const;

// The three steering examples the SteeringFigure cycles through, in order
// (library → Gollum → Seattle). Base answers are English; steered answers are the
// same content nudged into French.
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
