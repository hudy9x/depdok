import { useSetAtom } from "jotai";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isChat2OpenAtom } from "../store/LLMChat2Store";

export function LLMChat2HeaderActions() {
  const setIsChatOpen = useSetAtom(isChat2OpenAtom);

  return (
    <div data-tauri-drag-region="false" className="flex items-center gap-1 shrink-0">
      {/* Close chat */}
      <Button
        data-tauri-drag-region="false"
        variant="ghost"
        size="icon"
        className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground cursor-pointer"
        onClick={() => setIsChatOpen(false)}
        title="Close chat"
      >
        <X data-tauri-drag-region="false" className="h-4 w-4" />
      </Button>
    </div>
  );
}
