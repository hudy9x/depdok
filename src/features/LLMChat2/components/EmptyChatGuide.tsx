import React from "react";
import { LiquidOrb } from "@/components/LiquidOrb";
import { QuickPromptChips } from "./QuickPromptChips";

export interface EmptyChatGuideProps {
  onSelectPrompt: (prompt: string) => void;
}

export const EmptyChatGuide: React.FC<EmptyChatGuideProps> = ({ onSelectPrompt }) => {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-4">
      <div className="w-12 h-12 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center">
        <LiquidOrb size={28} />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">Frontend Tool-Calling v2</p>
        <p className="text-xs text-muted-foreground max-w-sm leading-relaxed">
          Live streaming tokens from local Ollama. Type{" "}
          <code className="text-sky-400 font-semibold">@</code> to mention files, review &amp; update
          markdown live.
        </p>
      </div>

      {/* Quick Test Prompt Chips */}
      <QuickPromptChips onSelectPrompt={onSelectPrompt} />
    </div>
  );
};
