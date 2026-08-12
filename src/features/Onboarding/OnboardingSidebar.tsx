import { Check, BookOpen, Sparkles, User, Palette, Folder } from 'lucide-react';
import { ONBOARDING_STEPS, type OnboardingStep } from './types';

interface OnboardingSidebarProps {
  currentStep: OnboardingStep;
  onSelectStep: (step: OnboardingStep) => void;
}

const STEP_ICONS = [User, Palette, Folder];

export function OnboardingSidebar({
  currentStep,
  onSelectStep,
}: OnboardingSidebarProps): JSX.Element {
  return (
    <div className="md:col-span-2 p-6 sm:p-8 flex flex-col border-b md:border-b-0 md:border-r border-border bg-card">
      {/* Brand Header */}
      <div className="flex items-center gap-2 mb-8">
        <span className="w-7 h-7 rounded-lg bg-primary text-primary-foreground flex items-center justify-center shrink-0 shadow-xs">
          <Sparkles className="w-4 h-4" />
        </span>
        <span className="font-semibold text-lg text-foreground tracking-tight">
          Depdok
        </span>
      </div>

      {/* Welcome Title */}
      <h1 className="text-2xl font-bold text-foreground leading-tight mb-1.5">
        Welcome to Depdok.
      </h1>
      <p className="text-sm text-muted-foreground leading-relaxed mb-8">
        Let's get your workspace set up — it only takes a minute.
      </p>

      {/* Steps Navigation List */}
      <div className="flex flex-col gap-2">
        {ONBOARDING_STEPS.map((s, idx) => {
          const stepIndex = idx as OnboardingStep;
          const done = stepIndex < currentStep;
          const active = stepIndex === currentStep;
          const StepIcon = STEP_ICONS[idx] || User;

          return (
            <button
              key={s.key}
              type="button"
              onClick={() => {
                if (stepIndex <= currentStep) onSelectStep(stepIndex);
              }}
              className={`relative w-full text-left flex items-start gap-3.5 rounded-xl px-3.5 py-3 transition-all cursor-pointer ${
                active
                  ? 'bg-primary/10 text-foreground'
                  : 'hover:bg-accent/50 text-muted-foreground'
              }`}
            >
              {active && (
                <span className="absolute left-0 top-2 bottom-2 w-1 rounded-full bg-primary" />
              )}

              <span
                className={`w-8 h-8 shrink-0 rounded-lg flex items-center justify-center transition-colors ${
                  active
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : done
                    ? 'bg-primary/20 text-primary font-semibold'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {done ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <StepIcon className="w-4 h-4" />
                )}
              </span>

              <span className="min-w-0 flex-1">
                <span
                  className={`block text-sm font-semibold leading-tight ${
                    active || done ? 'text-foreground' : 'text-muted-foreground'
                  }`}
                >
                  {s.title}
                </span>
                <span className="block text-xs text-muted-foreground leading-snug mt-1">
                  {s.desc}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {/* Sidebar Footer */}
      <div className="mt-auto pt-8 flex items-center gap-4 text-xs text-muted-foreground border-t border-border/50">
        <a
          href="#"
          onClick={(e) => e.preventDefault()}
          className="hover:text-foreground transition-colors inline-flex items-center gap-1.5"
        >
          <BookOpen className="w-3.5 h-3.5" />
          Docs
        </a>
        <span>&middot;</span>
        <a
          href="#"
          onClick={(e) => e.preventDefault()}
          className="hover:text-foreground transition-colors"
        >
          Support
        </a>
      </div>
    </div>
  );
}
