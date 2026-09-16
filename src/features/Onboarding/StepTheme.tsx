import { Laptop, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { ReferenceArtwork } from "./ReferenceArtwork";

interface StepThemeProps { currentTheme: string | undefined; onSelectTheme: (theme: "light" | "dark" | "system") => void; }

export function StepTheme({ currentTheme, onSelectTheme }: StepThemeProps): JSX.Element {
  const { resolvedTheme } = useTheme();
  const activeTheme = currentTheme === "system" ? resolvedTheme : currentTheme;
  const options = [
    { id: "light" as const, label: "Light", desc: "Clean & bright", icon: Sun },
    { id: "dark" as const, label: "Dark", desc: "Easy on the eyes", icon: Moon },
    { id: "system" as const, label: "System", desc: "Match your OS", icon: Laptop },
  ];
  return (
    <div className="flex w-full max-w-[680px] flex-col items-center text-center">
      <ReferenceArtwork kind="theme" />
      <p className="text-[11px] font-bold uppercase tracking-[.18em] text-[#d76b4a]">Step 3 of 5 · Your reading room</p>
      <h2 className="mt-3 text-4xl font-bold leading-[.98] tracking-[-.06em] sm:text-[50px]">Choose a mood<br /><span className="text-[#d76b4a]">for your docs.</span></h2>
      <p className="mt-5 max-w-[450px] text-sm leading-6 text-[#79757b] sm:text-base">A small visual cue for all those long reading and writing sessions.</p>
      <div className="mt-8 grid w-full max-w-[600px] grid-cols-1 gap-3 sm:grid-cols-3">
        {options.map(({ id, label, desc, icon: Icon }) => {
          const selected = currentTheme === id;
          const previewDark = id === "dark" || (id === "system" && activeTheme === "dark");
          return <button key={id} type="button" onClick={() => onSelectTheme(id)} className={`rounded-2xl border p-3 text-left transition focus-visible:outline-none focus-visible:ring-0 ${selected ? "border-primary ring-4 ring-primary/25" : "border-border hover:border-primary/60"} ${id === "dark" ? "bg-[#29282e] text-white" : id === "system" ? "bg-muted" : "bg-card text-foreground"}`}><span className={`block h-24 overflow-hidden rounded-xl border p-3 ${previewDark ? "border-white/10 bg-[#38373d]" : id === "light" ? "border-[#e2dfd9] bg-[#fbfaf7]" : "border-border bg-[#fbfaf7]"}`}><span className="mb-3 flex gap-1"><i className={`h-2 w-2 rounded-full ${previewDark ? "bg-[#77737b]" : "bg-[#e7e3dd]"}`} /><i className={`h-2 w-2 rounded-full ${previewDark ? "bg-[#77737b]" : "bg-[#e7e3dd]"}`} /></span><span className={`block h-2 w-3/4 rounded-full ${previewDark ? "bg-[#8e8992]" : "bg-[#d8d4ce]"}`} /><span className={`mt-2 block h-2 w-full rounded-full ${previewDark ? "bg-[#5a5760]" : "bg-[#ebe8e2]"}`} /><span className={`mt-2 block h-2 w-1/2 rounded-full ${previewDark ? "bg-[#5a5760]" : "bg-[#ebe8e2]"}`} /></span><span className="mt-3 flex items-center gap-2 text-sm font-semibold"><Icon className="h-4 w-4" />{label}</span><span className={`mt-1 block text-xs ${id === "dark" ? "text-white/60" : id === "light" ? "text-muted-foreground" : "text-muted-foreground"}`}>{desc}</span></button>;
        })}
      </div>
    </div>
  );
}
