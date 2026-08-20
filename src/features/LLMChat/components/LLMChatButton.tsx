import { useAtom } from "jotai";
import { HiOutlineChatBubbleBottomCenterText } from "react-icons/hi2";

import { Button } from "@/components/ui/button";
import { isChatOpenAtom } from "../store/LLMChatStore";

export function LLMChatButton() {
  const [isChatOpen, setIsChatOpen] = useAtom(isChatOpenAtom);

  return (
    <Button
      data-tauri-drag-region="false"
      variant="ghost"
      size="icon"
      className={`h-7 w-7 cursor-pointer transition-colors ${isChatOpen
        ? "text-primary hover:text-primary"
        : "text-muted-foreground hover:text-foreground"
        }`}
      onClick={() => setIsChatOpen(!isChatOpen)}
      title={`${isChatOpen ? "Close" : "Open"} AI Chat`}
    >
      <HiOutlineChatBubbleBottomCenterText data-tauri-drag-region="false" className="!h-4 !w-4" />
    </Button>
  );
}
