import { useState } from "react";
import { ChevronDown, ChevronRight, Wrench } from "lucide-react";
import type { ToolCallPendingEvent } from "../api/llm";

interface LLMChatToolCallProps {
  toolCall: ToolCallPendingEvent;
  output?: string;
  isPending?: boolean;
}

export function LLMChatToolCall({ toolCall, output, isPending }: LLMChatToolCallProps) {
  const [expanded, setExpanded] = useState(false);

  let parsedArgs: Record<string, unknown> = {};
  try {
    parsedArgs = JSON.parse(toolCall.args);
  } catch {
    parsedArgs = { raw: toolCall.args };
  }

  let parsedOutput: unknown = output;
  if (output) {
    try {
      parsedOutput = JSON.parse(output);
    } catch {
      parsedOutput = output;
    }
  }

  return (
    <div className="rounded-lg border border-border/60 bg-muted/20 text-xs overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full px-3 py-2 text-left cursor-pointer hover:bg-muted/40 transition-colors"
      >
        <Wrench className="h-3 w-3 text-primary shrink-0" />
        <span className="font-mono font-semibold text-foreground">
          {toolCall.name}
        </span>
        {isPending && (
          <span className="text-muted-foreground animate-pulse ml-1">running…</span>
        )}
        <div className="ml-auto">
          {expanded ? (
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3 w-3 text-muted-foreground" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border/40 divide-y divide-border/30">
          <div className="px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
              Input
            </p>
            <pre className="text-[11px] text-foreground/80 whitespace-pre-wrap font-mono overflow-x-auto max-h-40 overflow-y-auto">
              {JSON.stringify(parsedArgs, null, 2)}
            </pre>
          </div>
          {output && (
            <div className="px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                Output
              </p>
              <pre className="text-[11px] text-foreground/80 whitespace-pre-wrap font-mono overflow-x-auto max-h-40 overflow-y-auto">
                {typeof parsedOutput === "string"
                  ? parsedOutput
                  : JSON.stringify(parsedOutput, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
