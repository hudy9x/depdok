import { type AvatarPreset } from '@/lib/userProfile';

interface OnboardingLivePreviewProps {
  userName: string;
  avatar: AvatarPreset;
  isDarkPreview?: boolean;
}

export function OnboardingLivePreview({
  userName,
  avatar,
  isDarkPreview = false,
}: OnboardingLivePreviewProps): JSX.Element {
  const displayName = userName.trim() || 'Your name';

  return (
    <div
      className={`rounded-xl p-4 border mb-6 transition-all duration-300 shadow-xs ${
        isDarkPreview
          ? 'bg-neutral-900 border-neutral-800 text-neutral-100'
          : 'bg-card border-border text-card-foreground'
      }`}
    >
      {/* File Header & Window Controls */}
      <div className="flex items-center gap-2 mb-3">
        <span className="w-2.5 h-2.5 rounded-full bg-red-400/80" />
        <span className="w-2.5 h-2.5 rounded-full bg-amber-400/80" />
        <span
          className={`w-2.5 h-2.5 rounded-full ${
            isDarkPreview ? 'bg-neutral-700' : 'bg-muted'
          }`}
        />
        <span
          className={`ml-2 text-xs font-mono ${
            isDarkPreview ? 'text-neutral-400' : 'text-muted-foreground'
          }`}
        >
          getting-started.md
        </span>
      </div>

      {/* Content Skeleton Lines */}
      <div className="space-y-2 mb-4">
        <div
          className={`h-2.5 rounded w-4/5 ${
            isDarkPreview ? 'bg-neutral-800' : 'bg-muted'
          }`}
        />
        <div
          className={`h-2.5 rounded w-full ${
            isDarkPreview ? 'bg-neutral-800' : 'bg-muted'
          }`}
        />
        <div
          className={`h-2.5 rounded w-3/5 ${
            isDarkPreview ? 'bg-neutral-800' : 'bg-muted'
          }`}
        />
      </div>

      {/* Live Comment Bubble */}
      <div
        className={`flex gap-3 rounded-lg p-3 border transition-colors ${
          isDarkPreview
            ? 'bg-neutral-950/80 border-neutral-800'
            : 'bg-accent/40 border-border/80'
        }`}
      >
        <span
          className="w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-base shadow-2xs"
          style={{ backgroundColor: avatar.bg }}
        >
          {avatar.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span
              className={`text-xs font-semibold truncate ${
                isDarkPreview ? 'text-neutral-100' : 'text-foreground'
              }`}
            >
              {displayName}
              {!userName.trim() && (
                <span className="inline-block w-0.5 h-3 bg-primary ml-0.5 align-middle animate-pulse" />
              )}
            </span>
            <span
              className={`text-[10px] shrink-0 ${
                isDarkPreview ? 'text-neutral-400' : 'text-muted-foreground'
              }`}
            >
              Just now
            </span>
          </div>
          <p
            className={`text-xs mt-0.5 leading-normal ${
              isDarkPreview ? 'text-neutral-300' : 'text-foreground/90'
            }`}
          >
            Looks good — let's ship this 🚀
          </p>
        </div>
      </div>
    </div>
  );
}
