import { useState } from "react";
import {
  FileText,
  Edit3,
  MessageSquareQuote,
  FilePlus,
  FolderPlus,
  Trash2,
  Database,
  Calculator,
  ChevronDown,
  ChevronRight,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Wrench,
  PenTool,
  BookOpen,
} from "lucide-react";
import { ToolExecutionLog } from "../store/LLMChat2Store";

interface ToolCallCardProps {
  log: ToolExecutionLog;
}

function getToolIcon(name: string) {
  switch (name) {
    case "search_knowledge_base":
    case "semantic_search":
    case "search_knowledge":
      return <BookOpen className="h-3.5 w-3.5 text-amber-300" />;
    case "generate_content":
      return <PenTool className="h-3.5 w-3.5 text-amber-400" />;
    case "read_markdown":
      return <FileText className="h-3.5 w-3.5 text-sky-400" />;
    case "upsert_markdown":
    case "update_markdown":
    case "upsert_markdown_section":
    case "update_markdown_section":
      return <Edit3 className="h-3.5 w-3.5 text-indigo-400" />;
    case "add_markdown_comment":
      return <MessageSquareQuote className="h-3.5 w-3.5 text-pink-400" />;
    case "create_file":
      return <FilePlus className="h-3.5 w-3.5 text-emerald-400" />;
    case "create_folder":
      return <FolderPlus className="h-3.5 w-3.5 text-emerald-400" />;
    case "rename_file":
    case "rename_folder":
      return <Edit3 className="h-3.5 w-3.5 text-violet-400" />;
    case "delete_file_or_folder":
    case "delete_node":
      return <Trash2 className="h-3.5 w-3.5 text-red-400" />;
    case "get_user_name":
    case "get_user_age":
    case "get_user_country":
    case "get_user_dob":
      return <Database className="h-3.5 w-3.5 text-cyan-400" />;
    case "sum_four_digits":
      return <Calculator className="h-3.5 w-3.5 text-purple-400" />;
    default:
      return <Wrench className="h-3.5 w-3.5 text-muted-foreground" />;
  }
}

function formatToolSummary(name: string, args: unknown, result: unknown): string {
  const parsedArgs = typeof args === "object" && args !== null ? (args as Record<string, unknown>) : {};
  const parsedResult = typeof result === "object" && result !== null ? (result as Record<string, unknown>) : {};

  switch (name) {
    case "search_knowledge_base":
    case "semantic_search":
    case "search_knowledge": {
      const query = parsedArgs.query ? `"${parsedArgs.query}"` : "query";
      const total = typeof parsedResult.totalFound === "number" ? ` (${parsedResult.totalFound} found)` : "";
      return `Searched knowledge base for ${query}${total}`;
    }
    case "generate_content": {
      const topic = parsedArgs.topic ? `"${parsedArgs.topic}"` : "requested topic";
      const model = parsedResult.modelUsed || "gemma2:9b";
      return `Generated rich content via ${model} for ${topic}`;
    }
    case "read_markdown": {
      const fileName = parsedResult.fileName || parsedArgs.path || "active document";
      const words = parsedResult.wordCount ? ` (${parsedResult.wordCount} words)` : "";
      return `Read ${fileName}${words}`;
    }
    case "upsert_markdown":
    case "update_markdown": {
      const fileName = parsedResult.fileName || parsedArgs.path || "active document";
      return `Upserted markdown ${fileName}`;
    }
    case "upsert_markdown_section":
    case "update_markdown_section": {
      const heading = parsedArgs.heading ? `'${parsedArgs.heading}'` : "target section";
      const fileName = parsedResult.fileName ? ` in ${parsedResult.fileName}` : "";
      const action = parsedResult.action === "appended" ? "Added" : "Updated";
      return `${action} section ${heading}${fileName}`;
    }
    case "add_markdown_comment": {
      const fileName = parsedResult.fileName || parsedArgs.path || "document";
      return `Added review comment to ${fileName}`;
    }
    case "create_file":
      return `Created file '${parsedArgs.path || "new_file"}'`;
    case "create_folder":
      return `Created folder '${parsedArgs.path || "new_folder"}'`;
    case "rename_file":
      return `Renamed '${parsedArgs.old_path}' ➔ '${parsedArgs.new_name}'`;
    case "rename_folder":
      return `Renamed folder '${parsedArgs.old_path}' ➔ '${parsedArgs.new_name}'`;
    case "delete_file_or_folder":
      return `Deleted '${parsedArgs.path}'`;
    case "sum_four_digits":
      return parsedResult !== undefined
        ? `Calculated sum = ${JSON.stringify(parsedResult)}`
        : `Sum ${parsedArgs.a}, ${parsedArgs.b}, ${parsedArgs.c}, ${parsedArgs.d}`;
    case "get_user_name":
    case "get_user_age":
    case "get_user_country":
    case "get_user_dob":
      return `Lookup ${name.replace("get_user_", "")}: ${JSON.stringify(parsedResult || parsedArgs)}`;
    default:
      return `${name}()`;
  }
}

export function ToolCallCard({ log }: ToolCallCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const summaryText = formatToolSummary(log.toolName, log.args, log.result);

  return (
    <div className="my-1.5 rounded-xl border border-border/50 bg-background/60 shadow-sm overflow-hidden text-xs transition-all duration-200 hover:border-border">
      {/* Header bar */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left hover:bg-muted/30 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1 rounded-md bg-muted/50 shrink-0">
            {getToolIcon(log.toolName)}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-mono text-[11px] font-semibold text-foreground/90 truncate">
              {log.toolName}
            </span>
            <span className="text-[10px] text-muted-foreground truncate">
              {summaryText}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {log.status === "executing" && (
            <span className="flex items-center gap-1 text-[10px] text-amber-500 font-medium px-1.5 py-0.5 rounded bg-amber-500/10">
              <Loader2 className="h-3 w-3 animate-spin" /> Executing
            </span>
          )}
          {log.status === "success" && (
            <span className="flex items-center gap-1 text-[10px] text-emerald-500 font-medium px-1.5 py-0.5 rounded bg-emerald-500/10">
              <CheckCircle2 className="h-3 w-3" /> Done
            </span>
          )}
          {log.status === "error" && (
            <span className="flex items-center gap-1 text-[10px] text-red-500 font-medium px-1.5 py-0.5 rounded bg-red-500/10">
              <AlertCircle className="h-3 w-3" /> Failed
            </span>
          )}

          <div className="text-muted-foreground">
            {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </div>
        </div>
      </button>

      {/* Expanded details */}
      {isOpen && (
        <div className="px-3 pb-2.5 pt-1 space-y-2 border-t border-border/30 bg-muted/20 text-[11px]">
          <div>
            <span className="text-[10px] uppercase font-mono tracking-wider text-muted-foreground block mb-0.5">
              Arguments
            </span>
            <pre className="font-mono text-[10px] p-2 rounded-lg bg-background/80 border border-border/40 text-foreground/80 overflow-x-auto">
              {JSON.stringify(log.args, null, 2)}
            </pre>
          </div>

          {log.status === "success" && log.result !== undefined && (
            <div>
              <span className="text-[10px] uppercase font-mono tracking-wider text-emerald-500 block mb-0.5">
                Output
              </span>
              {typeof log.result === "object" &&
              log.result !== null &&
              Array.isArray((log.result as Record<string, unknown>).results) ? (
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {((log.result as Record<string, unknown>).results as Array<{
                    title?: string;
                    relativePath?: string;
                    score?: number;
                    content?: string;
                  }>).map((match, idx) => (
                    <div
                      key={idx}
                      className="p-2 rounded-lg bg-background/80 border border-border/40 space-y-1"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-foreground/90 truncate">
                          {match.title || match.relativePath}
                        </span>
                        {typeof match.score === "number" && (
                          <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 shrink-0">
                            score: {match.score}
                          </span>
                        )}
                      </div>
                      {match.relativePath && (
                        <div className="text-[10px] text-muted-foreground font-mono truncate">
                          {match.relativePath}
                        </div>
                      )}
                      {match.content && (
                        <p className="text-[10px] text-foreground/70 line-clamp-2 italic">
                          {match.content}
                        </p>
                      )}
                    </div>
                  ))}
                  {((log.result as Record<string, unknown>).results as unknown[]).length === 0 && (
                    <div className="p-2 rounded-lg bg-background/80 border border-border/40 text-muted-foreground italic text-[10px]">
                      {String(
                        (log.result as Record<string, unknown>).message || "No matches found."
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <pre className="font-mono text-[10px] p-2 rounded-lg bg-emerald-500/5 border border-emerald-500/20 text-emerald-400 overflow-x-auto max-h-40">
                  {JSON.stringify(log.result, null, 2)}
                </pre>
              )}
            </div>
          )}

          {log.status === "error" && log.error && (
            <div>
              <span className="text-[10px] uppercase font-mono tracking-wider text-red-500 block mb-0.5">
                Error
              </span>
              <div className="font-mono text-[10px] p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400">
                {log.error}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
