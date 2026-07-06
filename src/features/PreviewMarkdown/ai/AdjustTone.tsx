import type { Editor } from "@tiptap/react";
import { Briefcase, ChevronLeft, ChevronRight, Coffee, Heart, Megaphone, Mic, Shield, Zap } from "lucide-react";

import { useAiEdit } from "@/features/LLMChat/hooks/useAiEdit";

const TONES = [
  { label: "Professional", value: "professional", icon: Briefcase },
  { label: "Casual", value: "casual", icon: Coffee },
  { label: "Friendly", value: "friendly", icon: Heart },
  { label: "Direct", value: "direct", icon: Zap },
  { label: "Persuasive", value: "persuasive", icon: Megaphone },
  { label: "Confident", value: "confident", icon: Shield },
];

interface AdjustToneProps {
  editor: Editor;
  mode: "trigger" | "menu";
  onSelectToneMenu?: () => void;
  onBack?: () => void;
  onStart: () => void;
  onEnd: () => void;
}

export function AdjustTone({
  editor,
  mode,
  onSelectToneMenu,
  onBack,
  onStart,
  onEnd,
}: AdjustToneProps) {
  const { runEdit } = useAiEdit(editor);

  const handleTone = async (tone: string) => {
    onStart();
    await runEdit(
      `Adjust the tone of this text to be ${tone}. Keep the original meaning and content.`,
    );
    onEnd();
  };

  if (mode === "trigger") {
    return (
      <button
        onClick={onSelectToneMenu}
        className="flex items-center justify-between w-full px-2 py-1.5 text-xs rounded hover:bg-accent text-left"
        type="button"
      >
        <span className="flex items-center gap-2">
          <Mic className="w-3.5 h-3.5 text-muted-foreground" />
          Adjust tone
        </span>
        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-0.5">
      <button
        onClick={onBack}
        className="flex items-center gap-2 w-full px-2 py-1 text-xs font-semibold border-b border-border mb-1 hover:text-muted-foreground text-left"
        type="button"
      >
        <ChevronLeft className="w-3.5 h-3.5" />
        Back to actions
      </button>
      {TONES.map(({ label, value, icon: Icon }) => (
        <button
          key={value}
          onClick={() => handleTone(value)}
          className="flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-accent text-left"
          type="button"
        >
          <Icon className="w-3.5 h-3.5 text-muted-foreground" />
          {label}
        </button>
      ))}
    </div>
  );
}
