import { ArrowLeft, Folder, Edit3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AVATAR_PRESETS, type AvatarPreset } from '@/lib/userProfile';

interface StepGetStartedProps {
  userName: string;
  selectedAvatarId: string;
  onBack: () => void;
  onOpenFolder: () => void;
  onStartWriting: () => void;
}

export function StepGetStarted({
  userName,
  selectedAvatarId,
  onBack,
  onOpenFolder,
  onStartWriting,
}: StepGetStartedProps): JSX.Element {
  const currentAvatar: AvatarPreset =
    AVATAR_PRESETS.find((a) => a.id === selectedAvatarId) || AVATAR_PRESETS[1];

  const displayName = userName.trim() || 'friend';

  return (
    <div className="flex-1 flex flex-col justify-between">
      <div className="bg-card border border-border rounded-xl p-8 flex flex-col items-center text-center my-auto shadow-xs">
        <span
          className="w-14 h-14 rounded-full flex items-center justify-center text-2xl mb-4 shadow-sm"
          style={{ backgroundColor: currentAvatar.bg }}
        >
          {currentAvatar.emoji}
        </span>
        <h2 className="text-xl font-bold text-foreground mb-1.5">
          You're all set, {displayName}
        </h2>
        <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">
          Open a documentation folder to organize your Markdown files, or jump straight into writing.
        </p>
      </div>

      {/* Step Footer Actions */}
      <div className="mt-8 pt-6 border-t border-border/80 flex items-center justify-between">
        <Button variant="ghost" onClick={onBack} className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </Button>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={onOpenFolder} className="gap-2">
            <Folder className="w-4 h-4" />
            <span>Open Folder</span>
          </Button>
          <Button onClick={onStartWriting} className="gap-2">
            <Edit3 className="w-4 h-4" />
            <span>Start Writing</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
