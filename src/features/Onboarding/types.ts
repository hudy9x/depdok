export type OnboardingStep = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface StepItem {
  key: string;
  title: string;
  desc: string;
}

export const ONBOARDING_STEPS: StepItem[] = [
  {
    key: "name",
    title: "What should we call you?",
    desc: "This is how your teammates will see you in shared docs.",
  },
  {
    key: "avatar",
    title: "Give yourself a little character.",
    desc: "Pick a small visual signature. You can change it whenever you like.",
  },
  {
    key: "theme",
    title: "Choose a mood for your docs.",
    desc: "A small visual cue for all those long reading and writing sessions.",
  },
  {
    key: "ai",
    title: "A helpful sidekick.",
    desc: "Ollama is recommended for private, local help. You can also bring your own cloud key.",
  },
  {
    key: "folder",
    title: "Where should your docs live?",
    desc: "Choose the documentation folder you want to work in.",
  },
];
