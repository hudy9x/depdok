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
  Clock,
  Terminal,
  Globe,
  ExternalLink,
  HelpCircle,
  Send,
} from "lucide-react";
import { ToolExecutionLog } from "../store/LLMChat2Store";
import { normalizeAskOptions, submitUserAnswer } from "../tools/common/askUser";

interface ToolCallCardProps {
  log: ToolExecutionLog;
}

function getToolIcon(name: string) {
  switch (name) {
    case "ask_user":
    case "ask_question":
      return <HelpCircle className="h-3.5 w-3.5 text-indigo-400" />;
    case "run_shell":
    case "execute_shell":
    case "shell_command":
    case "exec_command":
      return <Terminal className="h-3.5 w-3.5 text-emerald-400" />;
    case "web_search":
    case "search_web":
    case "internet_search":
      return <Globe className="h-3.5 w-3.5 text-sky-400" />;
    case "fetch_web_page":
    case "read_web_page":
    case "fetch_url":
    case "read_url":
      return <ExternalLink className="h-3.5 w-3.5 text-cyan-400" />;
    case "search_knowledge_base":
    case "semantic_search":
    case "search_knowledge":
    case "list_knowledge_base_projects":
    case "list_projects":
    case "get_projects":
    case "list_knowledge_base_groups":
    case "list_groups":
    case "get_groups":
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
    case "get_current_datetime":
    case "get_datetime":
      return <Clock className="h-3.5 w-3.5 text-amber-400" />;
    default:
      return <Wrench className="h-3.5 w-3.5 text-muted-foreground" />;
  }
}

function formatToolSummary(name: string, args: unknown, result: unknown): string {
  const parsedArgs = typeof args === "object" && args !== null ? (args as Record<string, unknown>) : {};
  const parsedResult = typeof result === "object" && result !== null ? (result as Record<string, unknown>) : {};

  switch (name) {
    case "ask_user":
    case "ask_question": {
      const q = parsedArgs.question ? `"${parsedArgs.question}"` : "Clarification question";
      const sel = parsedResult.selected ? ` ➔ "${parsedResult.selected}"` : "";
      return `Ask: ${q}${sel}`;
    }
    case "get_current_datetime":
    case "get_datetime": {
      const formatted = parsedResult.formatted || parsedResult.compactTimestamp || parsedResult.iso;
      return formatted ? `Current datetime: ${formatted}` : "Checked current datetime";
    }
    case "run_shell":
    case "execute_shell":
    case "shell_command":
    case "exec_command": {
      const cmd = parsedArgs.command ? `"${parsedArgs.command}"` : "command";
      const exitStr = typeof parsedResult.exit_code === "number" ? ` (exit: ${parsedResult.exit_code})` : "";
      return `Ran: ${cmd}${exitStr}`;
    }
    case "web_search":
    case "search_web":
    case "internet_search": {
      const query = parsedArgs.query ? `"${parsedArgs.query}"` : "query";
      const total = typeof parsedResult.total_found === "number" ? ` (${parsedResult.total_found} results)` : "";
      return `Searched web for ${query}${total}`;
    }
    case "fetch_web_page":
    case "read_web_page":
    case "fetch_url":
    case "read_url": {
      const title = parsedResult.title ? `"${parsedResult.title}"` : (parsedArgs.url ? `"${parsedArgs.url}"` : "webpage");
      const chars = typeof parsedResult.character_count === "number" ? ` (${parsedResult.character_count} chars)` : "";
      return `Fetched webpage ${title}${chars}`;
    }
    case "search_knowledge_base":
    case "semantic_search":
    case "search_knowledge": {
      const query = parsedArgs.query ? `"${parsedArgs.query}"` : "query";
      const cats = Array.isArray(parsedArgs.categories)
        ? parsedArgs.categories.join(", ")
        : (parsedArgs.category || (Array.isArray(parsedResult.categories) ? parsedResult.categories.join(", ") : ""));
      const catScope = cats ? ` in [${cats}]` : "";
      const total = typeof parsedResult.totalFound === "number" ? ` (${parsedResult.totalFound} found)` : "";
      return `Searched knowledge base${catScope} for ${query}${total}`;
    }
    case "list_knowledge_base_projects":
    case "list_projects":
    case "get_projects":
    case "list_knowledge_base_groups":
    case "list_groups":
    case "get_groups": {
      const total = typeof parsedResult.totalFound === "number" ? ` (${parsedResult.totalFound} groups)` : "";
      return `Listed knowledge base projects${total}`;
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

function AskUserInteractiveView({ log }: { log: ToolExecutionLog }) {
  const [customInput, setCustomInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const parsedArgs = typeof log.args === "object" && log.args !== null ? (log.args as Record<string, unknown>) : {};
  const question = typeof parsedArgs.question === "string" ? parsedArgs.question : "Please select an option:";
  const options = normalizeAskOptions(parsedArgs.options);
  const allowCustom = parsedArgs.allow_custom !== false;

  const handleSelect = (choice: string, isCustom = false) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    submitUserAnswer(log.requestId, choice, isCustom);
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customInput.trim() || isSubmitting) return;
    handleSelect(customInput.trim(), true);
  };

  if (log.status === "success" && log.result) {
    const res = typeof log.result === "object" && log.result !== null ? (log.result as Record<string, unknown>) : {};
    const selectedText = typeof res.selected === "string" ? res.selected : JSON.stringify(log.result);
    return (
      <div className="p-2.5 bg-indigo-500/5 border border-indigo-500/20 rounded-xl space-y-1 my-1 text-xs">
        <div className="flex items-center gap-1.5 text-indigo-400 font-medium">
          <HelpCircle className="h-3.5 w-3.5 shrink-0" />
          <span>{question}</span>
        </div>
        <div className="flex items-center gap-1.5 pl-5 text-emerald-400 font-mono text-[11px]">
          <CheckCircle2 className="h-3 w-3 shrink-0" />
          <span className="text-foreground/80">User Selected:</span>
          <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 font-semibold">
            {selectedText}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 bg-gradient-to-b from-indigo-500/10 to-background/80 border border-indigo-500/30 rounded-xl space-y-2.5 my-1.5 shadow-sm">
      <div className="flex items-start gap-2">
        <div className="p-1 rounded-md bg-indigo-500/20 text-indigo-400 shrink-0 mt-0.5">
          <HelpCircle className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <h4 className="text-xs font-semibold text-foreground/95 leading-snug">{question}</h4>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Click an option below or type a custom answer
          </p>
        </div>
      </div>

      {options.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pl-6">
          {options.map((option, idx) => (
            <button
              key={idx}
              type="button"
              disabled={isSubmitting}
              onClick={() => handleSelect(option)}
              className="px-2.5 py-1.5 text-[11px] font-medium rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 hover:text-indigo-200 border border-indigo-500/25 hover:border-indigo-500/40 transition-all cursor-pointer active:scale-95 text-left"
            >
              {option}
            </button>
          ))}
        </div>
      )}

      {allowCustom && (
        <form onSubmit={handleCustomSubmit} className="flex items-center gap-1.5 pl-6 pt-0.5">
          <input
            type="text"
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            disabled={isSubmitting}
            placeholder="Or type custom clarification..."
            className="flex-1 h-7 px-2.5 text-[11px] bg-background/80 border border-border/60 rounded-lg focus:outline-none focus:border-indigo-500/60 text-foreground placeholder:text-muted-foreground/60 transition-colors"
          />
          <button
            type="submit"
            disabled={!customInput.trim() || isSubmitting}
            className="h-7 px-2.5 flex items-center gap-1 text-[11px] font-medium rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer shrink-0"
          >
            <Send className="h-3 w-3" />
            <span>Send</span>
          </button>
        </form>
      )}
    </div>
  );
}

export function ToolCallCard({ log }: ToolCallCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const summaryText = formatToolSummary(log.toolName, log.args, log.result);
  const isAskUser = log.toolName === "ask_user" || log.toolName === "ask_question";

  if (isAskUser && log.status === "executing") {
    return <AskUserInteractiveView log={log} />;
  }

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
              "stdout" in (log.result as Record<string, unknown>) &&
              "exit_code" in (log.result as Record<string, unknown>) ? (
                (() => {
                  const res = log.result as {
                    stdout?: string;
                    stderr?: string;
                    exit_code?: number;
                    duration_ms?: number;
                    cwd?: string;
                    truncated?: boolean;
                  };
                  return (
                    <div className="space-y-1.5 font-mono text-[10px]">
                      <div className="flex items-center justify-between text-[9px] text-muted-foreground">
                        <span className="truncate max-w-[60%]">cwd: {res.cwd || "workspace"}</span>
                        <span>
                          {res.duration_ms !== undefined ? `${res.duration_ms}ms · ` : ""}
                          exit code:{" "}
                          <span
                            className={
                              res.exit_code === 0
                                ? "text-emerald-400 font-semibold"
                                : "text-red-400 font-semibold"
                            }
                          >
                            {res.exit_code}
                          </span>
                        </span>
                      </div>
                      {res.stdout ? (
                        <pre className="p-2 rounded-lg bg-zinc-950/80 border border-zinc-800 text-emerald-300 overflow-x-auto max-h-48 whitespace-pre-wrap">
                          {res.stdout}
                        </pre>
                      ) : null}
                      {res.stderr ? (
                        <pre className="p-2 rounded-lg bg-zinc-950/80 border border-red-900/40 text-red-300 overflow-x-auto max-h-48 whitespace-pre-wrap">
                          {res.stderr}
                        </pre>
                      ) : null}
                      {!res.stdout && !res.stderr && (
                        <div className="text-muted-foreground italic p-1">
                          (No output returned)
                        </div>
                      )}
                    </div>
                  );
                })()
              ) : typeof log.result === "object" &&
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
