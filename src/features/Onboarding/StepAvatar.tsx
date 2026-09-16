import { Check } from "lucide-react";
import { AVATAR_PRESETS } from "@/lib/userProfile";
import { ReferenceArtwork } from "./ReferenceArtwork";

export function StepAvatar({ selectedAvatarId, onSelectAvatar }: { selectedAvatarId: string; onSelectAvatar: (id: string) => void }): JSX.Element {
  return (
    <div className="flex w-full max-w-[700px] flex-col items-center text-center">
      <ReferenceArtwork kind="avatar" />
      <p className="text-[11px] font-bold uppercase tracking-[.18em] text-[#d76b4a]">Step 2 of 5 · Your avatar</p>
      <h2 className="mt-3 text-4xl font-bold leading-[.98] tracking-[-.06em] sm:text-[50px]">Give yourself<br /><span className="text-[#d76b4a]">a little character.</span></h2>
      <p className="mt-5 max-w-[450px] text-sm leading-6 text-[#79757b] sm:text-base">Pick a small visual signature. You can change it whenever you like.</p>
      <div className="mt-8 grid w-full max-w-[600px] grid-cols-3 gap-2 sm:grid-cols-6">
        {AVATAR_PRESETS.map((avatar) => {
          const selected = avatar.id === selectedAvatarId;
          return <button key={avatar.id} type="button" onClick={() => onSelectAvatar(avatar.id)} className={`relative rounded-2xl border bg-[#fbfaf9] p-2.5 text-center transition ${selected ? "border-[#d76b4a] bg-[#faebe4] shadow-[0_0_0_2px_rgba(215,107,74,.15)]" : "border-[#dfdcda] hover:border-[#d76b4a]"}`}><span className={`absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#d76b4a] text-white transition ${selected ? "opacity-100" : "opacity-0"}`}><Check className="h-2.5 w-2.5" /></span><span className="block text-2xl leading-9">{avatar.emoji}</span><span className="block text-[11px] font-semibold">{avatar.label}</span></button>;
        })}
      </div>
    </div>
  );
}
