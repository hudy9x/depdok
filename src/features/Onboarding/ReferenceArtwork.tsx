export type ArtworkKind = "welcome" | "name" | "avatar" | "theme" | "ai" | "folder" | "done";

const artwork = {
  welcome: ["h-20 w-28 rounded-md bg-[#c48869] rotate-[-25deg]", "h-20 w-28 rounded-md bg-[#dba987] rotate-[29deg]", "h-16 w-40 rounded-[50%] bg-[#efe3e0] rotate-[-6deg]"],
  name: ["h-24 w-24 rounded-[45%] bg-[#a8d6be] rotate-[12deg]", "h-14 w-14 rounded-full bg-[#e8f5eb] border-2 border-[#2f7954] rotate-[-12deg]", "h-14 w-32 rounded-[50%] bg-[#eadff0] rotate-[-7deg]"],
  avatar: ["h-20 w-20 rounded-full bg-[#c7e3ee] rotate-[-12deg]", "h-16 w-16 rounded-full bg-[#f9e5b7] rotate-[12deg]", "h-14 w-40 rounded-[50%] bg-[#efe8f2] rotate-[7deg]"],
  theme: ["h-20 w-20 rounded-[25px] bg-[#b994d1] rotate-[15deg]", "h-14 w-14 rounded-[18px] bg-[#f6e8bd] rotate-[29deg]", "h-24 w-24 rounded-[28px] bg-[#e9dff0] rotate-[-12deg]"],
  ai: ["h-20 w-20 rounded-full bg-[#b98ac8]", "h-16 w-16 rounded-[18px] bg-[#ecd9f2] rotate-[18deg]", "h-14 w-40 rounded-[50%] bg-[#e9e0ef] rotate-[-6deg]"],
  folder: ["h-20 w-20 rounded-[22px] bg-[#97c4d5] rotate-[-15deg]", "h-16 w-16 rounded-[18px] bg-[#d7e9ef] rotate-[18deg]", "h-14 w-40 rounded-[50%] bg-[#e6edf1] rotate-[7deg]"],
  done: ["h-20 w-20 rounded-[25px] bg-[#d7b5e6] rotate-[12deg]", "h-16 w-16 rounded-[20px] bg-[#f1e5f4] rotate-[-15deg]", "h-14 w-40 rounded-[50%] bg-[#e8e0ef] rotate-[-7deg]"],
} as const;

export function ReferenceArtwork({ kind }: { kind: ArtworkKind }): JSX.Element {
  const [back, front, shadow] = artwork[kind];
  const icon = {
    welcome: "",
    name: "✎",
    avatar: "▣",
    theme: "☼",
    ai: "✦",
    folder: "⌂",
    done: "✓",
  }[kind];
  return (
    <div className="relative mx-auto mb-5 h-36 w-56" aria-hidden="true">
      <div className={`absolute left-1/2 top-11 -translate-x-1/2 ${shadow} opacity-80`} />
      <div className={`absolute left-[39%] top-2 flex ${back} items-center justify-center shadow-[inset_-10px_-9px_0_rgba(60,50,70,.10)]`} />
      <div className={`absolute left-[49%] top-6 flex ${front} items-center justify-center border border-black/10 text-2xl text-[#1e1e24]`}>
        {icon}
      </div>
    </div>
  );
}
