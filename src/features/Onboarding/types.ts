export type OnboardingStep = 0 | 1 | 2;

export interface StepItem {
  key: string;
  title: string;
  desc: string;
}

export const ONBOARDING_STEPS: StepItem[] = [
  {
    key: 'profile',
    title: 'Set up your profile',
    desc: 'Your name and avatar as teammates will see them.',
  },
  {
    key: 'theme',
    title: 'Choose your theme',
    desc: 'How Depdok looks while you read and write.',
  },
  {
    key: 'start',
    title: 'Get started',
    desc: 'Open a folder or jump straight into writing.',
  },
];
