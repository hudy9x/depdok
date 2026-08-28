import { useState, useRef, useEffect, useCallback } from "react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { Loader2, Plus } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { Button } from "@/components/ui/button";
import {
  isChat2OpenAtom,
  chat2MessagesAtom,
  activeToolCallAtom,
  isGeneratingAtom,
  chat2ModelAtom,
  chat2ContentModelAtom,
  chat2IsStatefulAtom,
  chat2NumCtxAtom,
  chat2PanelWidthAtom,
  chat2MetricsAtom,
  chat2WebSearchEnabledAtom,
  chat2ThinkingEnabledAtom,
  availableSkillsAtom,
  activeSkillAtom,
  ChatMessage,
  ToolExecutionLog,
  Skill,
} from "../store/LLMChat2Store";
import { workspaceRootAtom, refreshDirectoryAtom } from "@/features/FileExplorer/store";
import { useToolListener } from "../hooks/useToolListener";
import { useTokenSmoother } from "../hooks/useTokenSmoother";
import { FileMentionPopup, MentionItem } from "./FileMentionPopup";
import { SlashCommandPopup, SlashItem } from "./SlashCommandPopup";
import { EmptyChatGuide } from "./EmptyChatGuide";
import { UserChatMessage } from "./UserChatMessage";
import { AssistantChatMessage } from "./AssistantChatMessage";
import { SystemChatMessage } from "./SystemChatMessage";
import { LLMChat2Input } from "./LLMChat2Input";
import { ContextUsageGauge } from "./ContextUsageGauge";
import { clearAllMcpServers } from "@/api-client/mcp";

interface OllamaMessagePayload {
  role: string;
  content: string;
  tool_calls?: Array<{
    function: {
      name: string;
      arguments: unknown;
    };
  }>;
}

function formatHistoryForBackend(messages: ChatMessage[]): OllamaMessagePayload[] {
  const result: OllamaMessagePayload[] = [];

  for (const msg of messages) {
    if (msg.role === "user") {
      if (msg.content.trim()) {
        result.push({ role: "user", content: msg.content.trim() });
      }
    } else if (msg.role === "assistant") {
      if (msg.parts && msg.parts.length > 0) {
        let currentAssistantText = "";
        const pendingToolCalls: ToolExecutionLog[] = [];

        for (const part of msg.parts) {
          if (part.type === "text") {
            if (pendingToolCalls.length > 0) {
              result.push({
                role: "assistant",
                content: currentAssistantText,
                tool_calls: pendingToolCalls.map((tc) => ({
                  function: {
                    name: tc.toolName,
                    arguments: tc.args,
                  },
                })),
              });
              for (const tc of pendingToolCalls) {
                if (tc.status === "success" && tc.result !== undefined) {
                  result.push({
                    role: "tool",
                    content: typeof tc.result === "string" ? tc.result : JSON.stringify(tc.result),
                  });
                }
              }
              currentAssistantText = "";
              pendingToolCalls.length = 0;
            }
            currentAssistantText += (currentAssistantText ? "\n\n" : "") + part.content;
          } else if (part.type === "tool") {
            pendingToolCalls.push(part.toolCall);
          }
        }

        if (pendingToolCalls.length > 0) {
          result.push({
            role: "assistant",
            content: currentAssistantText,
            tool_calls: pendingToolCalls.map((tc) => ({
              function: {
                name: tc.toolName,
                arguments: tc.args,
              },
            })),
          });
          for (const tc of pendingToolCalls) {
            if (tc.status === "success" && tc.result !== undefined) {
              result.push({
                role: "tool",
                content: typeof tc.result === "string" ? tc.result : JSON.stringify(tc.result),
              });
            }
          }
        } else if (currentAssistantText.trim()) {
          result.push({
            role: "assistant",
            content: currentAssistantText.trim(),
          });
        }
      } else if (msg.toolCalls && msg.toolCalls.length > 0) {
        result.push({
          role: "assistant",
          content: msg.content || "",
          tool_calls: msg.toolCalls.map((tc) => ({
            function: {
              name: tc.toolName,
              arguments: tc.args,
            },
          })),
        });

        for (const tc of msg.toolCalls) {
          if (tc.status === "success" && tc.result !== undefined) {
            result.push({
              role: "tool",
              content: typeof tc.result === "string" ? tc.result : JSON.stringify(tc.result),
            });
          }
        }
      } else if (msg.content.trim()) {
        result.push({ role: "assistant", content: msg.content.trim() });
      }
    }
  }

  return result;
}

export function LLMChat2Panel() {
  const isChatOpen = useAtomValue(isChat2OpenAtom);
  const [messages, setMessages] = useAtom(chat2MessagesAtom);
  const [isGenerating, setIsGenerating] = useAtom(isGeneratingAtom);
  const model = useAtomValue(chat2ModelAtom);
  const contentModel = useAtomValue(chat2ContentModelAtom);
  const isStateful = useAtomValue(chat2IsStatefulAtom);
  const numCtx = useAtomValue(chat2NumCtxAtom);
  const isWebSearchEnabled = useAtomValue(chat2WebSearchEnabledAtom);
  const isThinkingEnabled = useAtomValue(chat2ThinkingEnabledAtom);
  const setMetrics = useSetAtom(chat2MetricsAtom);
  const activeToolCall = useAtomValue(activeToolCallAtom);

  const [availableSkills, setAvailableSkills] = useAtom(availableSkillsAtom);
  const [activeSkill, setActiveSkill] = useAtom(activeSkillAtom);
  const workspaceRoot = useAtomValue(workspaceRootAtom);
  const refreshDirectory = useSetAtom(refreshDirectoryAtom);

  const [inputVal, setInputVal] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const currentAssistantMsgIdRef = useRef<string | null>(null);

  const handleNewChat = () => {
    setMessages([]);
    setMetrics(null);
    clearLogs();
    clearTokens();
  };

  // Mention (@) state
  const [isMentionOpen, setIsMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionStartIndex, setMentionStartIndex] = useState<number | null>(null);
  const [mentionItems, setMentionItems] = useState<MentionItem[]>([]);
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);

  // Slash (/) state
  const [isSlashOpen, setIsSlashOpen] = useState(false);
  const [slashQuery, setSlashQuery] = useState("");
  const [slashStartIndex, setSlashStartIndex] = useState<number | null>(null);
  const [slashItems, setSlashItems] = useState<SlashItem[]>([]);
  const [selectedSlashIndex, setSelectedSlashIndex] = useState(0);

  // Mount tool listener hook
  const { clearLogs } = useToolListener();

  // Mount token smoother hook for buttery smooth streaming
  const { enqueueToken, enqueueThought, flush: flushTokens, clearAll: clearTokens } = useTokenSmoother();

  const getEffectiveWorkspaceRoot = useCallback(() => {
    return workspaceRoot && workspaceRoot.trim() ? workspaceRoot.trim() : "";
  }, [workspaceRoot]);

  // Load project skills from store cache on mount or workspaceRoot change
  useEffect(() => {
    const root = getEffectiveWorkspaceRoot();
    invoke<Skill[]>("llm2_skill_list", {
      workspaceRoot: root,
      workspace_root: root,
    })
      .then((skills) => setAvailableSkills(skills))
      .catch((err) => {
        console.error("Failed to load skills:", err);
      });
  }, [getEffectiveWorkspaceRoot, setAvailableSkills]);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  }, []);

  // Scroll to bottom once when chat panel opens
  useEffect(() => {
    if (isChatOpen) {
      setTimeout(() => {
        scrollToBottom("auto");
      }, 50);
    } else {
      clearAllMcpServers().catch((e) => console.error("Error clearing MCP servers on chat close:", e));
    }
  }, [isChatOpen, scrollToBottom]);

  // Clean up all MCP servers on component unmount
  useEffect(() => {
    return () => {
      clearAllMcpServers().catch((e) => console.error("Error clearing MCP servers on unmount:", e));
    };
  }, []);

  // Real-time token and thought streaming and metrics listener
  useEffect(() => {
    let unlistenToken: UnlistenFn | null = null;
    let unlistenThought: UnlistenFn | null = null;
    let unlistenDone: UnlistenFn | null = null;
    let unlistenMetrics: UnlistenFn | null = null;

    listen<{ message_id: string; chunk: string }>("llm2_token", (event) => {
      const { message_id, chunk } = event.payload;
      enqueueToken(message_id, chunk);
    }).then((unlisten) => {
      unlistenToken = unlisten;
    });

    listen<{ message_id: string; chunk: string }>("llm2_thought", (event) => {
      const { message_id, chunk } = event.payload;
      enqueueThought(message_id, chunk);
    }).then((unlisten) => {
      unlistenThought = unlisten;
    });

    listen<{ message_id: string; content: string }>("llm2_done", (event) => {
      const { message_id, content } = event.payload;
      flushTokens(message_id);
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id !== message_id) return msg;
          return {
            ...msg,
            content: msg.content || content,
          };
        })
      );
    }).then((unlisten) => {
      unlistenDone = unlisten;
    });

    listen<{
      message_id: string;
      prompt_tokens: number;
      completion_tokens: number;
      total_tokens: number;
      num_ctx: number;
      percent_consumed: number;
      remaining_tokens: number;
    }>("llm2_metrics", (event) => {
      setMetrics({
        promptTokens: event.payload.prompt_tokens,
        completionTokens: event.payload.completion_tokens,
        totalTokens: event.payload.total_tokens,
        numCtx: event.payload.num_ctx,
        percentConsumed: event.payload.percent_consumed,
        remainingTokens: event.payload.remaining_tokens,
      });
    }).then((unlisten) => {
      unlistenMetrics = unlisten;
    });

    return () => {
      unlistenToken?.();
      unlistenThought?.();
      unlistenDone?.();
      unlistenMetrics?.();
    };
  }, [enqueueToken, enqueueThought, flushTokens, setMessages, setMetrics]);

  // Check for '@' trigger in input text
  const checkMentionTrigger = (text: string, cursorPosition: number) => {
    const textBeforeCursor = text.slice(0, cursorPosition);
    const lastAtIndex = textBeforeCursor.lastIndexOf("@");

    if (lastAtIndex !== -1) {
      // Check that there is no space between @ and cursor
      const query = textBeforeCursor.slice(lastAtIndex + 1);
      if (!/\s/.test(query)) {
        setIsMentionOpen(true);
        setMentionQuery(query);
        setMentionStartIndex(lastAtIndex);
        setSelectedMentionIndex(0);
        return;
      }
    }

    setIsMentionOpen(false);
    setMentionQuery("");
    setMentionStartIndex(null);
  };

  // Check for '/' trigger in input text
  const checkSlashTrigger = (text: string, cursorPosition: number) => {
    const textBeforeCursor = text.slice(0, cursorPosition);
    const lastSlashIndex = textBeforeCursor.lastIndexOf("/");

    if (lastSlashIndex !== -1) {
      const isAtTokenStart = lastSlashIndex === 0 || /\s/.test(textBeforeCursor[lastSlashIndex - 1]);
      if (isAtTokenStart) {
        const query = textBeforeCursor.slice(lastSlashIndex + 1);
        if (!/\s/.test(query)) {
          setIsSlashOpen(true);
          setSlashQuery(query);
          setSlashStartIndex(lastSlashIndex);
          setSelectedSlashIndex(0);
          return;
        }
      }
    }

    setIsSlashOpen(false);
    setSlashQuery("");
    setSlashStartIndex(null);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    const cursor = e.target.selectionStart ?? val.length;
    setInputVal(val);
    checkMentionTrigger(val, cursor);
    checkSlashTrigger(val, cursor);
  };

  const handleSelectMention = (item: MentionItem) => {
    if (mentionStartIndex === null) return;

    const before = inputVal.slice(0, mentionStartIndex);
    const after = inputVal.slice(mentionStartIndex + 1 + mentionQuery.length);
    const isFolder = Boolean(item.isDir || item.type === "folder");
    const formattedRelPath = isFolder
      ? item.relativePath.endsWith("/")
        ? item.relativePath
        : `${item.relativePath}/`
      : item.relativePath;
    const replacement = `@${formattedRelPath} `;
    const newVal = `${before}${replacement}${after}`;

    setInputVal(newVal);
    setIsMentionOpen(false);
    setMentionQuery("");
    setMentionStartIndex(null);

    // Focus input and set cursor position after inserted mention
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        const nextPos = before.length + replacement.length;
        inputRef.current.setSelectionRange(nextPos, nextPos);
      }
    }, 10);
  };

  const handleStopGeneration = useCallback(async () => {
    const activeId = currentAssistantMsgIdRef.current;
    try {
      await invoke("llm2_cancel_generation", {
        messageId: activeId,
        message_id: activeId,
      });
    } catch (err) {
      console.error("Failed to cancel llm2 generation:", err);
    } finally {
      if (activeId) {
        flushTokens(activeId);
      }
      setIsGenerating(false);
      currentAssistantMsgIdRef.current = null;
    }
  }, [flushTokens, setIsGenerating]);

  // Execute hardcoded command /skill-setup
  const handleExecuteSkillSetup = async () => {
    const root = getEffectiveWorkspaceRoot();

    try {
      const skills = await invoke<Skill[]>("llm2_skill_setup", {
        workspaceRoot: root,
        workspace_root: root,
      });
      setAvailableSkills(skills);
      if (root) {
        refreshDirectory(root).catch(console.error);
      }

      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "system",
          content: `✨ **Skills System Initialized (${skills.length} loaded)**\n\nCreated \`.depdok/skills/\` directory with default \`skill-creator.md\` template.\n\nType \`/skill-creator\` to start interviewing and creating your first customized skill.`,
          timestamp: new Date(),
        },
      ]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "system",
          content: `❌ **Skill setup failed:** ${msg}`,
          timestamp: new Date(),
        },
      ]);
    }
  };

  // Execute hardcoded command /skill-reload
  const handleExecuteSkillReload = async () => {
    const root = getEffectiveWorkspaceRoot();

    try {
      const skills = await invoke<Skill[]>("llm2_skill_reload", {
        workspaceRoot: root,
        workspace_root: root,
      });
      setAvailableSkills(skills);
      if (root) {
        refreshDirectory(root).catch(console.error);
      }

      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "system",
          content:
            skills.length === 0
              ? `🔄 **Reloaded — 0 skills found in \`.depdok/skills/\`.**\n\nRun \`/skill-setup\` to initialize project skill templates.`
              : `🔄 **Reloaded — ${skills.length} skill${skills.length === 1 ? "" : "s"} found:**\n\n${skills
                .map((s) => `- \`/${s.name}\` — *${s.description}* (${s.tools.length === 0 ? "no tools" : s.tools.join(", ")})`)
                .join("\n")}`,
          timestamp: new Date(),
        },
      ]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "system",
          content: `❌ **Skill reload failed:** ${msg}`,
          timestamp: new Date(),
        },
      ]);
    }
  };

  const handleSelectSlash = async (item: SlashItem) => {
    if (item.type === "command") {
      // Remove the slash query token from inputVal
      if (slashStartIndex !== null) {
        const before = inputVal.slice(0, slashStartIndex);
        const after = inputVal.slice(slashStartIndex + 1 + slashQuery.length);
        setInputVal(`${before}${after}`.trim());
      }

      setIsSlashOpen(false);
      setSlashQuery("");
      setSlashStartIndex(null);

      if (item.name === "skill-setup") {
        await handleExecuteSkillSetup();
      } else if (item.name === "skill-reload") {
        await handleExecuteSkillReload();
      }
    } else if (item.type === "skill") {
      // Insert /skill-name into inputVal, keeping it visible inline
      if (slashStartIndex === null) return;
      const before = inputVal.slice(0, slashStartIndex);
      const after = inputVal.slice(slashStartIndex + 1 + slashQuery.length);
      const replacement = `/${item.name} `;
      const newVal = `${before}${replacement}${after}`;

      setInputVal(newVal);
      setIsSlashOpen(false);
      setSlashQuery("");
      setSlashStartIndex(null);

      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          const nextPos = before.length + replacement.length;
          inputRef.current.setSelectionRange(nextPos, nextPos);
        }
      }, 10);
    }
  };

  const handleSend = async (customPrompt?: string) => {
    const textToSend = (customPrompt || inputVal).trim();
    if (!textToSend || isGenerating) return;

    // Handle direct commands sent in chat
    if (textToSend === "/skill-setup") {
      setInputVal("");
      setIsSlashOpen(false);
      await handleExecuteSkillSetup();
      return;
    }
    if (textToSend === "/skill-reload") {
      setInputVal("");
      setIsSlashOpen(false);
      await handleExecuteSkillReload();
      return;
    }

    // Parse all /<skill-name> tokens from textToSend (e.g. "/kb /meeting-summarizer please analyze @doc.md")
    const skillMatches = Array.from(
      textToSend.matchAll(/(?:^|\s)\/([a-z0-9-]+)(?=\s|$)/g)
    ).map((m) => m[1]);

    const uniqueSkillNames = Array.from(new Set(skillMatches));
    const matchedSkills = uniqueSkillNames
      .map((name) => availableSkills.find((s) => s.name.toLowerCase() === name.toLowerCase()))
      .filter((s): s is Skill => Boolean(s));

    // Assemble system prompt addendum from all matched skills
    let systemPromptAddendum: string | undefined = undefined;
    if (matchedSkills.length > 0) {
      systemPromptAddendum = matchedSkills
        .map((s) => `### Active Skill: /${s.name}\n${s.body.trim()}`)
        .join("\n\n---\n\n");
    }

    // Combine allowed tools from all matched skills
    let allowedTools: string[] | undefined = undefined;
    if (matchedSkills.length > 0) {
      const combinedTools = Array.from(new Set(matchedSkills.flatMap((s) => s.tools)));
      allowedTools = combinedTools;
    } else if (!isWebSearchEnabled) {
      // Exclude web search tools when web toggle is OFF, while preserving all MCP tools
      allowedTools = [
        "search_knowledge_base",
        "generate_content",
        "sum_four_digits",
        "get_user_name",
        "get_user_age",
        "get_user_country",
        "get_user_dob",
        "create_file",
        "create_folder",
        "rename_file",
        "rename_folder",
        "delete_file_or_folder",
        "move_files_or_folders",
        "list_files",
        "read_markdown",
        "upsert_markdown",
        "upsert_markdown_section",
        "add_markdown_comment",
        "write_skill",
        "get_current_datetime",
        "run_shell",
        "mcp",
      ];
    }

    const historyPayload = isStateful ? formatHistoryForBackend(messages) : undefined;

    const assistantMsgId = crypto.randomUUID();
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: textToSend,
      timestamp: new Date(),
    };

    const placeholderAssistantMsg: ChatMessage = {
      id: assistantMsgId,
      role: "assistant",
      content: "",
      toolCalls: [],
      parts: [],
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg, placeholderAssistantMsg]);
    setInputVal("");
    setActiveSkill(null);
    setIsMentionOpen(false);
    setIsSlashOpen(false);
    setIsGenerating(true);
    currentAssistantMsgIdRef.current = assistantMsgId;

    // Scroll to bottom when user sends a message
    setTimeout(() => {
      scrollToBottom("smooth");
    }, 50);

    try {
      const response = await invoke<string>("llm2_send_message", {
        prompt: textToSend,
        model: model.trim() || undefined,
        contentModel: contentModel.trim() || undefined,
        content_model: contentModel.trim() || undefined,
        messageId: assistantMsgId,
        message_id: assistantMsgId,
        history: historyPayload,
        numCtx: numCtx,
        num_ctx: numCtx,
        systemPromptAddendum: systemPromptAddendum,
        system_prompt_addendum: systemPromptAddendum,
        allowedTools: allowedTools,
        allowed_tools: allowedTools,
        think: isThinkingEnabled,
      });

      // Ensure final assistant message has full content if stream was missed or buffered
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMsgId
            ? { ...msg, content: msg.content.trim() ? msg.content : response }
            : msg
        )
      );
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMsgId
            ? {
              ...msg,
              content: `⚠️ **Error executing request:** ${errorMsg}\n\n*Make sure Ollama is running locally (\`ollama run ${model}\`)*`,
            }
            : msg
        )
      );
    } finally {
      flushTokens(assistantMsgId);
      setIsGenerating(false);
      currentAssistantMsgIdRef.current = null;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (isSlashOpen && slashItems.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedSlashIndex((prev) => (prev + 1) % slashItems.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedSlashIndex((prev) => (prev - 1 + slashItems.length) % slashItems.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        const selected = slashItems[selectedSlashIndex] || slashItems[0];
        if (selected) {
          handleSelectSlash(selected);
        }
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setIsSlashOpen(false);
        return;
      }
    }

    if (isMentionOpen && mentionItems.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedMentionIndex((prev) => (prev + 1) % mentionItems.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedMentionIndex((prev) => (prev - 1 + mentionItems.length) % mentionItems.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        const selected = mentionItems[selectedMentionIndex] || mentionItems[0];
        if (selected) {
          handleSelectMention(selected);
        }
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setIsMentionOpen(false);
        return;
      }
    }

    if (isGenerating && e.key === "Escape") {
      e.preventDefault();
      handleStopGeneration();
      return;
    }

    if (e.key === "Escape" && activeSkill) {
      e.preventDefault();
      setActiveSkill(null);
      return;
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const [panelWidth, setPanelWidth] = useAtom(chat2PanelWidthAtom);

  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const startWidth = panelWidth;

      const onMouseMove = (moveEvent: MouseEvent) => {
        const delta = startX - moveEvent.clientX;
        const nextWidth = Math.max(300, Math.min(800, startWidth + delta));
        setPanelWidth(nextWidth);
      };

      const onMouseUp = () => {
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.body.style.cursor = "ew-resize";
      document.body.style.userSelect = "none";
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    },
    [panelWidth, setPanelWidth]
  );

  const handleSelectPrompt = (promptText: string) => {
    setInputVal(promptText);
    inputRef.current?.focus();
  };

  if (!isChatOpen) return null;

  return (
    <div
      className="h-full flex flex-col shrink-0 relative bg-layout-chrome border-l border-border select-none overflow-hidden"
      style={{ width: panelWidth }}
    >
      {/* Drag handle on left border */}
      <div
        className="absolute top-0 bottom-0 left-0 w-1.5 z-20 cursor-ew-resize hover:bg-primary/40 transition-colors"
        style={{ background: "transparent" }}
        onMouseDown={handleDragStart}
      />

      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/60 shrink-0 bg-muted/20">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleNewChat}
          className="h-7 px-2 gap-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 cursor-pointer"
          title="Start new chat"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>New Chat</span>
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 select-text">
        {messages.length === 0 ? (
          <EmptyChatGuide onSelectPrompt={handleSelectPrompt} />
        ) : (
          <>
            {messages.map((msg, index) =>
              msg.role === "user" ? (
                <UserChatMessage key={msg.id} message={msg} />
              ) : msg.role === "system" ? (
                <SystemChatMessage key={msg.id} message={msg} />
              ) : (
                <AssistantChatMessage
                  key={msg.id}
                  message={msg}
                  isGenerating={isGenerating && index === messages.length - 1}
                  activeToolCall={index === messages.length - 1 ? activeToolCall : null}
                />
              )
            )}

            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Active tool activity footer banner */}
      {activeToolCall && (
        <div className="px-4 py-1.5 bg-primary/10 border-t border-primary/20 flex items-center justify-between text-[11px] text-primary shrink-0">
          <div className="flex items-center gap-1.5 font-mono">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>Frontend executing: {activeToolCall.toolName}</span>
          </div>
          <span className="text-[10px] text-primary/80">Awaiting React bridge...</span>
        </div>
      )}

      {/* Input Section with Unified Outer Wrapper (Usage on Top + Input Card right below) */}
      <div className="p-3 pt-0 shrink-0 relative">
        <SlashCommandPopup
          isOpen={isSlashOpen}
          query={slashQuery}
          selectedIndex={selectedSlashIndex}
          availableSkills={availableSkills}
          onSelect={handleSelectSlash}
          onClose={() => setIsSlashOpen(false)}
          onItemsChange={setSlashItems}
        />

        <FileMentionPopup
          isOpen={isMentionOpen}
          query={mentionQuery}
          selectedIndex={selectedMentionIndex}
          onSelect={handleSelectMention}
          onClose={() => setIsMentionOpen(false)}
          onItemsChange={setMentionItems}
        />

        {/* Gray/Muted Wrapper enclosing Usage at top and Input Card directly behind it */}
        <div className="bg-muted/40 border border-border/60 rounded-3xl p-1.5 space-y-1 shadow-xs">
          {/* Top Usage Section */}
          <ContextUsageGauge className="px-2 py-0.5" />

          {/* Chat Input Card */}
          <LLMChat2Input
            inputVal={inputVal}
            setInputVal={setInputVal}
            isGenerating={isGenerating}
            onSend={handleSend}
            onStop={handleStopGeneration}
            inputRef={inputRef}
            onInputChange={handleInputChange}
            onKeyDown={handleKeyDown}
          />
        </div>
      </div>
    </div>
  );
}
