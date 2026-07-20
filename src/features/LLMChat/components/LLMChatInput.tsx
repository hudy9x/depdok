import { useCallback, useRef, useState, useEffect, KeyboardEvent } from "react";
import { useAtom, useAtomValue } from "jotai";
import { Send, Square, Paperclip, FileCode, X, Eye } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { tabsAtom, isDummyPath } from "@/stores/TabStore";
import { workspaceRootAtom } from "@/features/FileExplorer/store";
import { fuzzySearchFiles } from "@/features/FileSearchDialog/api";
import type { SearchResult } from "@/features/FileSearchDialog/api";
import { readFileContent } from "@/lib/fileOperations";
import { estimateTokens } from "@/lib/tokenUtils";

import { taggedFilesAtom } from "../store/LLMChatStore";
import { buildPromptPayload } from "../lib/promptBuilder";

interface LLMChatInputProps {
  onSend: (text: string) => void;
  onStop: () => void;
  isGenerating: boolean;
  disabled?: boolean;
}

export function LLMChatInput({ onSend, onStop, isGenerating, disabled }: LLMChatInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [taggedFiles, setTaggedFiles] = useAtom(taggedFilesAtom);
  const tabs = useAtomValue(tabsAtom);
  const workspaceRoot = useAtomValue(workspaceRootAtom);

  // Tagging Autocomplete State
  const [isTagging, setIsTagging] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [triggerIndex, setTriggerIndex] = useState(-1);
  const [activeIndex, setActiveIndex] = useState(0);

  // Token Estimation State
  const [fileTokens, setFileTokens] = useState(0);
  const [previewPayload, setPreviewPayload] = useState("");

  // Calculate tokens for attached files whenever they change
  useEffect(() => {
    let active = true;
    const fetchFiles = async () => {
      let totalTokens = 0;
      for (const f of taggedFiles) {
        try {
          const content = await readFileContent(f.path);
          totalTokens += estimateTokens(content);
        } catch (err) {
          // Ignore errors for estimation
        }
      }
      if (active) {
        setFileTokens(totalTokens);
      }
    };
    fetchFiles();
    return () => {
      active = false;
    };
  }, [taggedFiles]);

  const currentTokens = estimateTokens(value) + fileTokens + (taggedFiles.length > 0 ? 150 : 0);
  const tokenColorClass = currentTokens > 4000 ? "text-destructive font-semibold" : "text-muted-foreground/80";

  const handlePreviewOpen = async (open: boolean) => {
    if (open) {
      setPreviewPayload("Loading preview...");
      const payload = await buildPromptPayload(value, taggedFiles);
      setPreviewPayload(payload);
    }
  };

  // Debounced fuzzy search for workspace files when tagging
  useEffect(() => {
    if (!workspaceRoot || !searchQuery) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const results = await fuzzySearchFiles(searchQuery, 10);
        setSearchResults(results);
      } catch (error) {
        console.error("Failed to search workspace files:", error);
        setSearchResults([]);
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [searchQuery, workspaceRoot]);

  // Check if cursor is currently typing a file tag (e.g. `@filename`)
  const checkTagging = useCallback((text: string, selectionEnd: number) => {
    const textBeforeCursor = text.slice(0, selectionEnd);
    const match = textBeforeCursor.match(/(?:^|\s)@(\S*)$/);
    
    if (match) {
      setIsTagging(true);
      setSearchQuery(match[1]);
      setTriggerIndex(match.index! + (match[0].startsWith(" ") ? 1 : 0));
    } else {
      setIsTagging(false);
      setSearchQuery("");
      setTriggerIndex(-1);
    }
  }, []);

  // Filter open tabs and search results
  const openTabsList = tabs
    .filter((tab) => !isDummyPath(tab.filePath) && !taggedFiles.some((f) => f.path === tab.filePath));

  const workspaceResultsList = searchResults
    .map((res) => {
      const fullPath = `${workspaceRoot}/${res.path}`;
      const fileName = res.path.split("/").pop() || res.path;
      return { name: fileName, path: fullPath };
    })
    .filter((file) => !taggedFiles.some((f) => f.path === file.path));

  // Reset active index when suggestions list size changes
  useEffect(() => {
    setActiveIndex(0);
  }, [searchQuery, searchResults, openTabsList.length]);

  const handleAttachFile = useCallback((file: { name: string; path: string }) => {
    setTaggedFiles((prev) => {
      if (prev.some((f) => f.path === file.path)) return prev;
      return [...prev, file];
    });

    // Replace the '@query' string in the input value
    if (triggerIndex !== -1 && textareaRef.current) {
      const cursorPosition = textareaRef.current.selectionEnd;
      const textBefore = value.slice(0, triggerIndex);
      const textAfter = value.slice(cursorPosition);
      const newValue = textBefore + textAfter;
      setValue(newValue);

      // Reset height
      textareaRef.current.style.height = "auto";

      // Focus and position cursor
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(triggerIndex, triggerIndex);
        }
      }, 0);
    }

    setIsTagging(false);
    setSearchQuery("");
    setTriggerIndex(-1);
  }, [value, triggerIndex, setTaggedFiles]);

  const handleSend = useCallback(() => {
    const text = value.trim();
    if (!text || isGenerating) return;
    onSend(text);
    setValue("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    setIsTagging(false);
    setSearchQuery("");
    setTriggerIndex(-1);
  }, [value, isGenerating, onSend]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (isTagging) {
      const totalItems = searchQuery === "" ? openTabsList.length : workspaceResultsList.length;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((prev) => (totalItems > 0 ? (prev + 1) % totalItems : 0));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((prev) => (totalItems > 0 ? (prev - 1 + totalItems) % totalItems : 0));
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const activeFile = searchQuery === "" ? openTabsList[activeIndex] : workspaceResultsList[activeIndex];
        if (activeFile) {
          if ('filePath' in activeFile) {
            handleAttachFile({ name: activeFile.fileName, path: activeFile.filePath });
          } else {
            handleAttachFile(activeFile);
          }
        }
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setIsTagging(false);
        setSearchQuery("");
        setTriggerIndex(-1);
        return;
      }
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  };

  const handleChange = (val: string) => {
    setValue(val);
    if (textareaRef.current) {
      checkTagging(val, textareaRef.current.selectionEnd);
    }
  };

  const handleKeyUpOrClick = () => {
    if (textareaRef.current) {
      checkTagging(value, textareaRef.current.selectionEnd);
    }
  };

  // Programmatically trigger tagging when Paperclip button is clicked
  const handlePaperclipClick = () => {
    if (!textareaRef.current) return;
    const cursor = textareaRef.current.selectionEnd;
    const before = value.slice(0, cursor);
    const after = value.slice(cursor);
    const spacing = (cursor === 0 || before.endsWith(" ")) ? "" : " ";
    const newValue = before + spacing + "@" + after;
    setValue(newValue);

    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        const newCursor = cursor + spacing.length + 1;
        textareaRef.current.setSelectionRange(newCursor, newCursor);
        checkTagging(newValue, newCursor);
      }
    }, 0);
  };

  return (
    <div className="border-t border-border/60 p-3 flex flex-col gap-2 bg-background/50 relative">
      {/* Inline Floating Suggestions List */}
      {isTagging && (
        <div className="absolute bottom-[calc(100%-8px)] left-3 right-3 max-h-[220px] overflow-y-auto border border-border/60 bg-background/95 backdrop-blur-xl shadow-2xl rounded-xl p-1 z-50 animate-in fade-in slide-in-from-bottom-2 duration-150">
          <div className="text-[10px] font-semibold text-muted-foreground px-2 py-1 uppercase tracking-wider border-b border-border/40 mb-1 flex justify-between items-center">
            <span>{searchQuery === "" ? "Open Tabs" : "Workspace Files"}</span>
            <span className="text-[9px] lowercase font-normal italic">↑↓ to navigate, enter to select</span>
          </div>
          
          {searchQuery === "" && openTabsList.length === 0 && (
            <div className="text-xs text-muted-foreground px-2 py-3 text-center">
              No open tabs. Type a name to search workspace.
            </div>
          )}

          {searchQuery !== "" && workspaceResultsList.length === 0 && (
            <div className="text-xs text-muted-foreground px-2 py-3 text-center">
              No matching files found.
            </div>
          )}

          {searchQuery === "" ? (
            <div className="space-y-0.5">
              {openTabsList.map((tab, idx) => (
                <div
                  key={tab.id}
                  onClick={() => handleAttachFile({ name: tab.fileName, path: tab.filePath })}
                  onMouseEnter={() => setActiveIndex(idx)}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs cursor-pointer transition-colors ${
                    idx === activeIndex
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-foreground hover:bg-muted/50"
                  }`}
                >
                  <FileCode className={`h-3.5 w-3.5 ${idx === activeIndex ? "text-primary" : "text-muted-foreground"}`} />
                  <div className="flex flex-col min-w-0">
                    <span className="truncate">{tab.fileName}</span>
                    <span className="text-[9px] text-muted-foreground truncate max-w-[340px]">
                      {tab.filePath.replace((workspaceRoot || "") + "/", "")}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-0.5">
              {workspaceResultsList.map((file, idx) => (
                <div
                  key={`ws-${idx}`}
                  onClick={() => handleAttachFile(file)}
                  onMouseEnter={() => setActiveIndex(idx)}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs cursor-pointer transition-colors ${
                    idx === activeIndex
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-foreground hover:bg-muted/50"
                  }`}
                >
                  <FileCode className={`h-3.5 w-3.5 ${idx === activeIndex ? "text-primary" : "text-muted-foreground"}`} />
                  <div className="flex flex-col min-w-0">
                    <span className="truncate">{file.name}</span>
                    <span className="text-[9px] text-muted-foreground truncate max-w-[340px]">
                      {file.path.replace((workspaceRoot || "") + "/", "")}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tagged Files Bar */}
      {taggedFiles.length > 0 && (
        <div className="flex flex-wrap gap-1.5 max-h-[100px] overflow-y-auto pr-1">
          {taggedFiles.map((file, idx) => (
            <div
              key={idx}
              className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-primary/10 border border-primary/20 text-primary text-xs animate-in fade-in zoom-in-95 duration-150"
            >
              <FileCode className="h-3.5 w-3.5" />
              <span className="truncate max-w-[150px] font-medium" title={file.path}>
                {file.name}
              </span>
              <button
                type="button"
                onClick={() => setTaggedFiles((prev) => prev.filter((_, i) => i !== idx))}
                className="hover:bg-primary/20 rounded p-0.5 transition-colors cursor-pointer text-primary/75 hover:text-primary"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2 rounded-xl border border-border/60 bg-muted/20 px-3 py-2 focus-within:border-primary/50 transition-colors">
        {/* Attachment button */}
        <div className="shrink-0 pb-0.5">
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground cursor-pointer"
            disabled={disabled}
            onClick={handlePaperclipClick}
            title="Tag a file (@)"
          >
            <Paperclip className="h-4 w-4" />
          </Button>
        </div>

        <textarea
          ref={textareaRef}
          className="flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none min-h-[36px] max-h-[160px] overflow-y-auto leading-relaxed py-1"
          placeholder="Ask anything… (Type @ to tag a file)"
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          onKeyUp={handleKeyUpOrClick}
          onClick={handleKeyUpOrClick}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          disabled={disabled}
          rows={1}
        />
        <div className="shrink-0 pb-0.5">
          {isGenerating ? (
            <Button
              size="icon"
              variant="destructive"
              className="h-7 w-7 rounded-lg cursor-pointer"
              onClick={onStop}
              title="Stop generation"
            >
              <Square className="h-3.5 w-3.5 fill-current" />
            </Button>
          ) : (
            <Button
              size="icon"
              className="h-7 w-7 rounded-lg cursor-pointer"
              onClick={handleSend}
              disabled={!value.trim() || disabled}
              title="Send message"
            >
              <Send className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
      <div className="flex justify-between items-center mt-1 px-1">
        <p className="text-[10px] text-muted-foreground/60">
          Tools: read_file · write_file · list_directory · run_shell · web_search
        </p>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] ${tokenColorClass}`} title="Estimated tokens">
            Est. Tokens: ~{currentTokens.toLocaleString()}
          </span>
          <Dialog onOpenChange={handlePreviewOpen}>
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 text-muted-foreground hover:text-foreground cursor-pointer"
                title="Preview Prompt Payload"
              >
                <Eye className="h-3 w-3" />
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col p-4 sm:max-w-3xl">
              <DialogHeader>
                <DialogTitle>Prompt Preview</DialogTitle>
              </DialogHeader>
              <div className="flex-1 overflow-auto bg-muted/30 p-4 rounded-md border border-border text-xs whitespace-pre-wrap font-mono mt-2 selection:bg-primary/30">
                {previewPayload}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
}
