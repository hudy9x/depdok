import { useAtom } from "jotai";
import { Button } from "@/components/ui/button";
import { HiOutlineChatBubbleBottomCenterText } from "react-icons/hi2";
import { isChat2OpenAtom } from "../store/LLMChat2Store";

export function LLMChat2Button() {
  const [isChatOpen, setIsChatOpen] = useAtom(isChat2OpenAtom);

  return (
    <Button
      data-tauri-drag-region="false"
      variant="ghost"
      size="icon"
      className={`h-7 w-7 cursor-pointer transition-colors relative ${isChatOpen
          ? "text-primary hover:text-primary bg-accent"
          : "text-muted-foreground hover:text-foreground"
        }`}
      onClick={() => setIsChatOpen(!isChatOpen)}
      title={`${isChatOpen ? "Close" : "Open"} AI Chat v2 (Rig Tool Calling)`}
    >
      <HiOutlineChatBubbleBottomCenterText data-tauri-drag-region="false" className="!h-4 !w-4" />
    </Button>
  );
}

