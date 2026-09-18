import { useState } from "react";
import { Check } from "lucide-react";

interface RolePreset {
  id: string;
  label: string;
  emoji: string;
}

interface StepAvatarProps {
  selectedAvatarId: string;
  onSelectAvatar: (id: string) => void;
}

const ROLE_PRESETS: RolePreset[] = [
  { id: "writer", label: "Product Manager", emoji: "📋" },
  { id: "cat", label: "Business Analyst", emoji: "📊" },
  { id: "developer", label: "Software Engineer", emoji: "💻" },
  { id: "sparkles", label: "UX/UI Designer", emoji: "🎨" },
  { id: "ninja", label: "QA Engineer", emoji: "🧪" },
  { id: "rocket", label: "DevOps Engineer", emoji: "⚙️" },
];

const FALLBACK_EMOJIS = ["🧩", "🛠️", "💡", "🧠", "🔧", "🚀"];

function emojiForRole(role: string): string {
  const normalized = role.trim().toLowerCase();
  const matches: Array<[string[], string]> = [
    [["product", "manager", "owner", "scrum"], "📋"],
    [["business", "analyst", "data"], "📊"],
    [["design", "ux", "ui"], "🎨"],
    [["quality", "test", "qa"], "🧪"],
    [["devops", "cloud", "infra", "platform", "sre"], "⚙️"],
    [["security", "cyber"], "🛡️"],
    [["mobile", "ios", "android"], "📱"],
    [["frontend", "web"], "🖥️"],
    [["backend", "database"], "🗄️"],
    [["writer", "docs", "documentation"], "✍️"],
    [["engineer", "developer", "software", "code"], "💻"],
  ];
  const matched = matches.find(([keywords]) => keywords.some((keyword) => normalized.includes(keyword)));
  if (matched) return matched[1];
  if (!normalized) return "🧩";
  const hash = Array.from(normalized).reduce((total, character) => total + character.codePointAt(0)!, 0);
  return FALLBACK_EMOJIS[hash % FALLBACK_EMOJIS.length];
}

export function StepAvatar({ selectedAvatarId, onSelectAvatar }: StepAvatarProps): JSX.Element {
  const presetSelected = ROLE_PRESETS.some((role) => role.id === selectedAvatarId);
  const [customRole, setCustomRole] = useState(presetSelected ? "" : selectedAvatarId);
  const otherSelected = !presetSelected;

  const selectOther = (): void => {
    onSelectAvatar(customRole);
  };

  const updateCustomRole = (value: string): void => {
    setCustomRole(value);
    onSelectAvatar(value);
  };

  return (
    <div className="flex w-full max-w-[700px] flex-col items-center text-center">
      <img src="/boss-chair.png" alt="" aria-hidden="true" className="mx-auto mb-5 h-36 w-56 object-contain" />
      <p className="text-[11px] font-bold uppercase tracking-[.18em] text-primary">Step 2 of 5 · Your role</p>
      <h2 className="mt-3 text-4xl font-bold leading-[.98] tracking-[-.06em] sm:text-[50px]">
        What do you do<br /><span className="text-primary">on the team?</span>
      </h2>
      <p className="mt-5 max-w-[450px] text-sm leading-6 text-muted-foreground sm:text-base">
        Pick the software role that best describes your work.
      </p>
      <div className="mt-8 grid w-full max-w-[620px] grid-cols-2 gap-2 sm:grid-cols-4">
        {ROLE_PRESETS.map((role) => {
          const selected = role.id === selectedAvatarId;
          return (
            <button
              key={role.id}
              type="button"
              onClick={() => onSelectAvatar(role.id)}
              className={`relative rounded-2xl border bg-card p-3 text-center text-card-foreground transition active:scale-[0.98] ${selected ? "border-primary bg-primary/10 ring-2 ring-primary/20" : "border-border hover:border-primary/60 hover:bg-muted/40"}`}
            >
              <span className={`absolute right-2 top-2 flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground transition ${selected ? "opacity-100" : "opacity-0"}`}>
                <Check className="size-2.5" />
              </span>
              <span className="block text-2xl leading-9" aria-hidden="true">{role.emoji}</span>
              <span className="block text-[11px] font-semibold">{role.label}</span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={selectOther}
          className={`relative rounded-2xl border bg-card p-3 text-center text-card-foreground transition active:scale-[0.98] ${otherSelected ? "border-primary bg-primary/10 ring-2 ring-primary/20" : "border-border hover:border-primary/60 hover:bg-muted/40"}`}
        >
          <span className={`absolute right-2 top-2 flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground transition ${otherSelected ? "opacity-100" : "opacity-0"}`}>
            <Check className="size-2.5" />
          </span>
          <span className="block text-2xl leading-9" aria-hidden="true">{emojiForRole(customRole)}</span>
          <span className="block text-[11px] font-semibold">Other</span>
        </button>
      </div>
      {otherSelected && (
        <label className="mt-4 flex w-full max-w-[420px] items-center gap-3 rounded-xl bg-muted px-4 py-3 text-left focus-within:ring-2 focus-within:ring-primary/25">
          <span className="text-2xl" aria-hidden="true">{emojiForRole(customRole)}</span>
          <span className="sr-only">Your role</span>
          <input
            autoFocus
            value={customRole}
            onChange={(event) => updateCustomRole(event.target.value)}
            placeholder="Enter your role"
            className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-foreground outline-none placeholder:text-muted-foreground"
          />
        </label>
      )}
    </div>
  );
}
