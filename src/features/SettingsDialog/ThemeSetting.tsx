import { useAtom } from "jotai";
import { Check } from "lucide-react";
import { Label } from "@/components/ui/label";
import { themeAtom } from "@/stores/SettingsStore";
import { cn } from "@/lib/utils";

const LightMockup = ({ isSelected }: { isSelected: boolean }) => (
  <div className={cn(
    "relative w-full h-[76px] rounded-xl border bg-gradient-to-tr from-purple-100 to-indigo-100 dark:from-zinc-800 dark:to-zinc-700 overflow-hidden flex flex-col transition-all duration-300",
    isSelected ? "border-primary ring-2 ring-primary/20 bg-purple-100/40" : "border-border hover:border-muted-foreground/30"
  )}>
    {/* Window Mockup shifted right-bottom */}
    <div className="absolute top-2 left-2 right-[-20px] bottom-[-20px] rounded-tl-lg border-t border-l border-zinc-200 bg-zinc-50 flex flex-col overflow-hidden shadow-sm">
      {/* Titlebar */}
      <div className="h-3 border-b border-zinc-200/80 bg-zinc-100 flex items-center px-1.5 gap-0.5 shrink-0">
        <div className="w-1 h-1 rounded-full bg-zinc-300" />
        <div className="w-1 h-1 rounded-full bg-zinc-300" />
        <div className="w-1.5 h-0.5 bg-zinc-200 rounded-sm ml-0.5" />
      </div>
      {/* Body */}
      <div className="flex-1 flex min-h-0">
        {/* Sidebar */}
        <div className="w-[30%] border-r border-zinc-200/50 bg-zinc-50/50 p-1 space-y-1 shrink-0">
          <div className="h-0.5 bg-zinc-200 rounded-sm w-[70%]" />
          <div className="h-0.5 bg-zinc-200 rounded-sm w-[50%]" />
          <div className="h-0.5 bg-zinc-200 rounded-sm w-[60%]" />
        </div>
        {/* Content */}
        <div className="flex-1 p-1 space-y-1 bg-white">
          <div className="h-1 bg-zinc-100/80 rounded-sm w-full" />
          <div className="h-0.5 bg-zinc-100/80 rounded-sm w-[85%]" />
          <div className="h-0.5 bg-zinc-100/80 rounded-sm w-[90%]" />
        </div>
      </div>
    </div>

    {isSelected && (
      <div className="absolute bottom-2 left-2 bg-primary text-primary-foreground rounded-full p-0.5 shadow-sm z-20 animate-in fade-in zoom-in duration-200">
        <Check className="w-2.5 h-2.5 stroke-[3]" />
      </div>
    )}
  </div>
);

const DarkMockup = ({ isSelected }: { isSelected: boolean }) => (
  <div className={cn(
    "relative w-full h-[76px] rounded-xl border bg-gradient-to-tr from-indigo-950 to-blue-900 overflow-hidden flex flex-col transition-all duration-300",
    isSelected ? "border-primary ring-2 ring-primary/20 bg-indigo-950/20" : "border-zinc-800 hover:border-muted-foreground/30"
  )}>
    {/* Window Mockup shifted right-bottom */}
    <div className="absolute top-2 left-2 right-[-20px] bottom-[-20px] rounded-tl-lg border-t border-l border-zinc-800 bg-zinc-900 flex flex-col overflow-hidden shadow-sm">
      {/* Titlebar */}
      <div className="h-3 border-b border-zinc-800/80 bg-zinc-950 flex items-center px-1.5 gap-0.5 shrink-0">
        <div className="w-1 h-1 rounded-full bg-zinc-800" />
        <div className="w-1 h-1 rounded-full bg-zinc-800" />
        <div className="w-1.5 h-0.5 bg-zinc-800 rounded-sm ml-0.5" />
      </div>
      {/* Body */}
      <div className="flex-1 flex min-h-0">
        {/* Sidebar */}
        <div className="w-[30%] border-r border-zinc-800/50 bg-zinc-950/50 p-1 space-y-1 shrink-0">
          <div className="h-0.5 bg-zinc-800 rounded-sm w-[70%]" />
          <div className="h-0.5 bg-zinc-800 rounded-sm w-[50%]" />
          <div className="h-0.5 bg-zinc-800 rounded-sm w-[60%]" />
        </div>
        {/* Content */}
        <div className="flex-1 p-1 space-y-1 bg-zinc-950">
          <div className="h-1 bg-zinc-900/80 rounded-sm w-full" />
          <div className="h-0.5 bg-zinc-900/80 rounded-sm w-[85%]" />
          <div className="h-0.5 bg-zinc-900/80 rounded-sm w-[90%]" />
        </div>
      </div>
    </div>

    {isSelected && (
      <div className="absolute bottom-2 left-2 bg-primary text-primary-foreground rounded-full p-0.5 shadow-sm z-20 animate-in fade-in zoom-in duration-200">
        <Check className="w-2.5 h-2.5 stroke-[3]" />
      </div>
    )}
  </div>
);

const AutoMockup = ({ isSelected }: { isSelected: boolean }) => (
  <div className={cn(
    "relative w-full h-[76px] rounded-xl border overflow-hidden flex transition-all duration-300",
    isSelected ? "border-primary ring-2 ring-primary/20" : "border-border hover:border-muted-foreground/30"
  )}>
    {/* Background split */}
    <div className="absolute inset-0 flex">
      <div className="w-1/2 bg-gradient-to-tr from-purple-100 to-indigo-50 dark:from-zinc-800 dark:to-zinc-700" />
      <div className="w-1/2 bg-gradient-to-br from-indigo-950 to-zinc-950" />
    </div>

    {/* Window Mockup shifted right-bottom */}
    <div className="absolute top-2 left-2 right-[-20px] bottom-[-20px] rounded-tl-lg border-t border-l border-zinc-200 dark:border-zinc-800 bg-zinc-55 flex overflow-hidden shadow-sm">
      {/* Left split of window (Light) */}
      <div className="w-1/2 bg-zinc-50 border-r border-zinc-200/80 flex flex-col overflow-hidden">
        <div className="h-3 border-b border-zinc-200/80 bg-zinc-100 flex items-center px-1.5 gap-0.5 shrink-0">
          <div className="w-1 h-1 rounded-full bg-zinc-300" />
          <div className="w-1 h-1 rounded-full bg-zinc-300" />
        </div>
        <div className="flex-1 flex min-h-0">
          <div className="w-[40%] border-r border-zinc-200/50 bg-zinc-50/50 p-1 space-y-1 shrink-0">
            <div className="h-0.5 bg-zinc-200 rounded-sm w-[70%]" />
            <div className="h-0.5 bg-zinc-200 rounded-sm w-[50%]" />
          </div>
          <div className="flex-1 p-1 space-y-1 bg-white">
            <div className="h-1 bg-zinc-100 rounded-sm w-full" />
          </div>
        </div>
      </div>

      {/* Right split of window (Dark) */}
      <div className="w-1/2 bg-zinc-900 flex flex-col overflow-hidden">
        <div className="h-3 border-b border-zinc-800/80 bg-zinc-950 flex items-center px-1.5 gap-0.5 shrink-0 justify-end">
          <div className="w-1.5 h-0.5 bg-zinc-850 rounded-sm mr-0.5" />
          <div className="w-1 h-1 rounded-full bg-zinc-800" />
        </div>
        <div className="flex-1 flex min-h-0">
          <div className="w-[40%] border-r border-zinc-800/50 bg-zinc-950/50 p-1 space-y-1 shrink-0">
            <div className="h-0.5 bg-zinc-800 rounded-sm w-[70%]" />
            <div className="h-0.5 bg-zinc-800 rounded-sm w-[50%]" />
          </div>
          <div className="flex-1 p-1 space-y-1 bg-zinc-950">
            <div className="h-1 bg-zinc-900 rounded-sm w-full" />
          </div>
        </div>
      </div>
    </div>

    {isSelected && (
      <div className="absolute bottom-2 left-2 bg-primary text-primary-foreground rounded-full p-0.5 shadow-sm z-20 animate-in fade-in zoom-in duration-200">
        <Check className="w-2.5 h-2.5 stroke-[3]" />
      </div>
    )}
  </div>
);

export const ThemeSetting = (): JSX.Element => {
  const [selectedTheme, setSelectedTheme] = useAtom(themeAtom);

  return (
    <div className="grid grid-cols-1 md:grid-cols-[1fr_450px] gap-8 items-start">
      {/* Left Column: Label & Description */}
      <div className="space-y-1.5">
        <Label className="text-sm font-medium">Interface Theme</Label>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Customize your application appearance by selecting Light or Dark mode, or set it to Auto to follow your system settings.
        </p>
      </div>

      {/* Right Column: Visual Selectors */}
      <div className="grid grid-cols-3 gap-3 w-[420px]">
        {/* Auto Theme Card */}
        <button
          type="button"
          onClick={() => setSelectedTheme("system")}
          className="flex flex-col items-center gap-2 group cursor-pointer border-0 p-0 bg-transparent text-left outline-none shrink-0"
        >
          <AutoMockup isSelected={selectedTheme === "system"} />
          <span className={cn(
            "text-[10px] font-semibold text-center w-full block transition-colors",
            selectedTheme === "system" ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
          )}>
            Auto
          </span>
        </button>

        {/* Light Theme Card */}
        <button
          type="button"
          onClick={() => setSelectedTheme("light")}
          className="flex flex-col items-center gap-2 group cursor-pointer border-0 p-0 bg-transparent text-left outline-none shrink-0"
        >
          <LightMockup isSelected={selectedTheme === "light"} />
          <span className={cn(
            "text-[10px] font-semibold text-center w-full block transition-colors",
            selectedTheme === "light" ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
          )}>
            Light
          </span>
        </button>

        {/* Dark Theme Card */}
        <button
          type="button"
          onClick={() => setSelectedTheme("dark")}
          className="flex flex-col items-center gap-2 group cursor-pointer border-0 p-0 bg-transparent text-left outline-none shrink-0"
        >
          <DarkMockup isSelected={selectedTheme === "dark"} />
          <span className={cn(
            "text-[10px] font-semibold text-center w-full block transition-colors",
            selectedTheme === "dark" ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
          )}>
            Dark
          </span>
        </button>
      </div>
    </div>
  );
};
