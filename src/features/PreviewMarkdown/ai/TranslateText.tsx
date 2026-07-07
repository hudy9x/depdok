import type { Editor } from "@tiptap/react";
import { ChevronLeft, ChevronRight, Languages } from "lucide-react";

import { useAiEdit } from "@/features/LLMChat/hooks/useAiEdit";

const LANGUAGES = [
  { label: "English", flag: "🇺🇸" },
  { label: "Vietnamese", flag: "🇻🇳" },
  { label: "Spanish", flag: "🇪🇸" },
  { label: "Japanese", flag: "🇯🇵" },
  { label: "Chinese", flag: "🇨🇳" },
  { label: "French", flag: "🇫🇷" },
  { label: "German", flag: "🇩🇪" },
  { label: "Korean", flag: "🇰🇷" },
  { label: "Portuguese", flag: "🇧🇷" },
];

interface TranslateTextProps {
  editor: Editor;
  mode: "trigger" | "menu";
  onSelectTranslateMenu?: () => void;
  onBack?: () => void;
  onStart: () => void;
  onEnd: () => void;
}

export function TranslateText({
  editor,
  mode,
  onSelectTranslateMenu,
  onBack,
  onStart,
  onEnd,
}: TranslateTextProps) {
  const { runEdit } = useAiEdit(editor);

  const handleLanguage = async (language: string) => {
    onStart();
    await runEdit(`Translate the following text to ${language}. Return only the translated text.`);
    onEnd();
  };

  if (mode === "trigger") {
    return (
      <button
        onClick={onSelectTranslateMenu}
        className="flex items-center justify-between w-full px-2 py-1.5 text-xs rounded hover:bg-accent text-left"
        type="button"
      >
        <span className="flex items-center gap-2">
          <Languages className="w-3.5 h-3.5" />
          Translate
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
      {LANGUAGES.map(({ label, flag }) => (
        <button
          key={label}
          onClick={() => handleLanguage(label)}
          className="flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-accent text-left"
          type="button"
        >
          <span className="text-base leading-none">{flag}</span>
          {label}
        </button>
      ))}
    </div>
  );
}
