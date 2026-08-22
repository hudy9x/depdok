import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { Activity, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  chat2IsStatefulAtom,
  chat2LogsAtom,
  isChat2OpenAtom,
  chat2MessagesAtom,
  chat2MetricsAtom,
} from "../store/LLMChat2Store";

interface LLMChat2HeaderActionsProps {
  showToolDrawer: boolean;
  onToggleToolDrawer: () => void;
  onClearLogs?: () => void;
}

export function LLMChat2HeaderActions({
  showToolDrawer,
  onToggleToolDrawer,
  onClearLogs,
}: LLMChat2HeaderActionsProps) {
  const [isStateful, setIsStateful] = useAtom(chat2IsStatefulAtom);
  const setIsChatOpen = useSetAtom(isChat2OpenAtom);
  const setMessages = useSetAtom(chat2MessagesAtom);
  const setMetrics = useSetAtom(chat2MetricsAtom);
  const logs = useAtomValue(chat2LogsAtom);

  const handleClear = () => {
    setMessages([]);
    setMetrics(null);
    onClearLogs?.();
  };

  return (
    <div className="flex items-center gap-1.5 shrink-0">
      {/* Stateful / Stateless History Switch */}
      <div
        className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/40 border border-border/40 text-[10px]"
        title={
          isStateful
            ? "Stateful Mode (ON): Multi-turn conversation history is sent with each prompt."
            : "Stateless Mode (OFF): Each prompt is evaluated in complete isolation."
        }
      >
        <span
          className={`font-medium select-none transition-colors ${
            isStateful ? "text-sky-500 font-semibold" : "text-muted-foreground"
          }`}
        >
          {isStateful ? "History ON" : "History OFF"}
        </span>
        <Switch
          checked={isStateful}
          onCheckedChange={setIsStateful}
          className="scale-75 origin-right cursor-pointer"
        />
      </div>

      {/* Toggle tool execution monitor */}
      <Button
        variant="ghost"
        size="icon"
        className={`h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground relative ${
          showToolDrawer ? "bg-muted text-sky-400" : ""
        }`}
        onClick={onToggleToolDrawer}
        title="Toggle tool execution monitor"
      >
        <Activity className="h-4 w-4" />
        {logs.length > 0 && (
          <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-sky-500 ring-2 ring-background" />
        )}
      </Button>

      {/* Clear chat history */}
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground"
        onClick={handleClear}
        title="Clear chat history"
      >
        <Trash2 className="h-4 w-4" />
      </Button>

      {/* Close chat */}
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground"
        onClick={() => setIsChatOpen(false)}
        title="Close chat"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
