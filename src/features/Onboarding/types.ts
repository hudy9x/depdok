export type OnboardingStep = 0 | 1 | 2 | 3;

export interface StepItem {
  key: string;
  title: string;
  desc: string;
}

export const ONBOARDING_STEPS: StepItem[] = [
  {
    key: "profile",
    title: "Set up your profile",
    desc: "Your name and avatar as teammates will see them.",
  },
  {
    key: "theme",
    title: "Choose your appearance",
    desc: "How Depdok looks while you read and write.",
  },
  {
    key: "ai",
    title: "Set up AI",
    desc: "Optional: connect Ollama to use the AI assistant.",
  },
  {
    key: "start",
    title: "Open a folder",
    desc: "Choose the documentation folder you want to work in.",
  },
];
