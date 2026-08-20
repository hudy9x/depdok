import { useAtom } from "jotai";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isChat2OpenAtom } from "../store/LLMChat2Store";

export function LLMChat2Button() {
  const [isChatOpen, setIsChatOpen] = useAtom(isChat2OpenAtom);

  return (
    <Button
      data-tauri-drag-region="false"
      variant="ghost"
      size="icon"
      className={`h-7 w-7 cursor-pointer transition-colors relative ${
        isChatOpen
          ? "text-primary hover:text-primary bg-accent"
          : "text-muted-foreground hover:text-foreground"
      }`}
      onClick={() => setIsChatOpen(!isChatOpen)}
      title={`${isChatOpen ? "Close" : "Open"} AI Chat v2 (Rig Tool Calling)`}
    >
      <Sparkles data-tauri-drag-region="false" className="!h-4 !w-4 text-sky-500" />
      <span className="absolute -top-0.5 -right-0.5 text-[8px] font-bold px-1 rounded-full bg-sky-500/20 text-sky-500 leading-tight">
        2
      </span>
    </Button>
  );
}
