import { useAtom } from "jotai";
import { PiChatCircleText, PiChatCircleTextFill } from "react-icons/pi";
import { Button } from "@/components/ui/button";
import { isChatOpenAtom } from "../store/LLMChatStore";

export function LLMChatButton() {
  const [isChatOpen, setIsChatOpen] = useAtom(isChatOpenAtom);

  return (
    <Button
      variant="ghost"
      size="icon"
      className={`h-7 w-7 cursor-pointer transition-colors ${
        isChatOpen
          ? "text-primary hover:text-primary"
          : "text-muted-foreground hover:text-foreground"
      }`}
      onClick={() => setIsChatOpen(!isChatOpen)}
      title={`${isChatOpen ? "Close" : "Open"} AI Chat`}
    >
      {isChatOpen ? (
        <PiChatCircleTextFill className="!h-4.5 !w-4.5" />
      ) : (
        <PiChatCircleText className="!h-4.5 !w-4.5" />
      )}
    </Button>
  );
}
