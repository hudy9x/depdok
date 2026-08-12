import { ArrowRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { AVATAR_PRESETS, type AvatarPreset } from '@/lib/userProfile';
import { OnboardingLivePreview } from './OnboardingLivePreview';

interface StepProfileProps {
  userName: string;
  selectedAvatarId: string;
  onNameChange: (name: string) => void;
  onSelectAvatar: (id: string) => void;
  onNext: () => void;
}

export function StepProfile({
  userName,
  selectedAvatarId,
  onNameChange,
  onSelectAvatar,
  onNext,
}: StepProfileProps): JSX.Element {
  const currentAvatar: AvatarPreset =
    AVATAR_PRESETS.find((a) => a.id === selectedAvatarId) || AVATAR_PRESETS[1];

  return (
    <div className="flex-1 flex flex-col justify-between">
      <div className="space-y-5">
        {/* Live Comment Preview Card */}
        <OnboardingLivePreview userName={userName} avatar={currentAvatar} />

        {/* Name Input Field */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-foreground">
            Your name
          </label>
          <Input
            type="text"
            value={userName}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="e.g. Dai Nguyen"
            autoFocus
            className="h-10 text-sm bg-background border-border focus-visible:ring-primary"
            onKeyDown={(e) => {
              if (e.key === 'Enter') onNext();
            }}
          />
        </div>

        {/* Avatar Preset Selection Grid */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-foreground">
            Choose an avatar
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {AVATAR_PRESETS.map((a) => {
              const selected = selectedAvatarId === a.id;
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => onSelectAvatar(a.id)}
                  className={`flex items-center gap-2.5 border rounded-xl p-2.5 text-left bg-card transition-all cursor-pointer hover:-translate-y-0.5 ${
                    selected
                      ? 'border-primary ring-2 ring-primary/20 bg-primary/10 shadow-xs'
                      : 'border-border hover:border-border/80 hover:bg-accent/40'
                  }`}
                >
                  <span
                    className="w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0 shadow-2xs"
                    style={{ backgroundColor: a.bg }}
                  >
                    {a.emoji}
                  </span>
                  <span className="text-xs font-medium text-foreground truncate">
                    {a.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Step Footer Actions */}
      <div className="mt-8 pt-6 border-t border-border/80 flex justify-end">
        <Button onClick={onNext} className="gap-2">
          <span>Continue</span>
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
