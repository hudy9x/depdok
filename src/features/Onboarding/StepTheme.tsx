import { ArrowLeft, ArrowRight, Sun, Moon, Laptop } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AVATAR_PRESETS, type AvatarPreset } from '@/lib/userProfile';
import { OnboardingLivePreview } from './OnboardingLivePreview';

interface StepThemeProps {
  userName: string;
  selectedAvatarId: string;
  currentTheme: string | undefined;
  onSelectTheme: (theme: 'light' | 'dark' | 'system') => void;
  onBack: () => void;
  onNext: () => void;
}

export function StepTheme({
  userName,
  selectedAvatarId,
  currentTheme,
  onSelectTheme,
  onBack,
  onNext,
}: StepThemeProps): JSX.Element {
  const currentAvatar: AvatarPreset =
    AVATAR_PRESETS.find((a) => a.id === selectedAvatarId) || AVATAR_PRESETS[1];

  const isDarkPreview = currentTheme === 'dark';

  return (
    <div className="flex-1 flex flex-col justify-between">
      <div className="space-y-5">
        {/* Live Preview Card with Theme Switching */}
        <OnboardingLivePreview
          userName={userName}
          avatar={currentAvatar}
          isDarkPreview={isDarkPreview}
        />

        {/* Theme Cards Grid */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-foreground">
            Pick a look
          </label>
          <div className="grid grid-cols-3 gap-3">
            {[
              { id: 'light', icon: Sun, label: 'Light', desc: 'Clean & bright' },
              { id: 'dark', icon: Moon, label: 'Dark', desc: 'Easy on the eyes' },
              { id: 'system', icon: Laptop, label: 'System', desc: 'Match OS' },
            ].map(({ id, icon: Icon, label, desc }) => {
              const selected = currentTheme === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() =>
                    onSelectTheme(id as 'light' | 'dark' | 'system')
                  }
                  className={`bg-card border rounded-xl p-4 flex flex-col items-center gap-2 transition-all cursor-pointer hover:-translate-y-0.5 ${
                    selected
                      ? 'border-primary ring-2 ring-primary/20 bg-primary/10 shadow-xs'
                      : 'border-border hover:border-border/80 hover:bg-accent/40'
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm transition-colors ${
                      selected
                        ? 'bg-primary text-primary-foreground shadow-xs'
                        : 'bg-muted text-foreground'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-semibold text-foreground">
                    {label}
                  </span>
                  <span className="text-[11px] text-muted-foreground leading-tight text-center">
                    {desc}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Step Footer Actions */}
      <div className="mt-8 pt-6 border-t border-border/80 flex items-center justify-between">
        <Button variant="ghost" onClick={onBack} className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </Button>
        <Button onClick={onNext} className="gap-2">
          <span>Continue</span>
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
