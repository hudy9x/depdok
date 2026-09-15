import { useRef, useState, useEffect, type ReactNode } from "react";
import { Editor, useEditorState } from "@tiptap/react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  CaseSensitive,
  MessageSquare,
  MessageSquarePlus,
  Regex,
  Search,
  WholeWord,
  X,
} from "lucide-react";
import { BsCardList } from "react-icons/bs";
import { useAtomValue, useSetAtom } from "jotai";

import { BlockButtons } from "./MenuButtons";
import { MarkdownSizeControl, MarkdownSizeDropdown, type MarkdownEditorSize } from "./MarkdownSizeControl";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  addCommentThreadAtom,
  fileCommentThreadsAtomFamily,
  generateCommentId,
  useCommentAuthor,
  type CommentThread,
} from "./extensions/comment";
import { stringifyFrontmatter } from "./utils/frontmatter";

interface MarkdownBottomMenuProps {
  editor: Editor | null;
  editable?: boolean;
  size: MarkdownEditorSize;
  onSizeChange: (size: MarkdownEditorSize) => void;
  filePath?: string;
  isSidebarVisible?: boolean;
  onToggleSidebar?: () => void;
  isSearchOpen: boolean;
  onSearchToggle: () => void;
}

export function SearchAndReplacePanel({ editor, editable, open, onClose }: { editor: Editor; editable: boolean; open: boolean; onClose: () => void }) {
  const [, forceUpdate] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const storage = editor.storage.findAndReplace;
  const results = storage?.results ?? [];
  const currentIndex = storage?.currentIndex ?? null;
  const replaceTerm = storage?.replaceTerm ?? "";
  const caseSensitive = storage?.caseSensitive ?? false;
  const wholeWord = storage?.wholeWord ?? false;
  const useRegex = storage?.useRegex ?? false;

  useEffect(() => {
    const handleTransaction = () => forceUpdate((value) => value + 1);
    editor.on("transaction", handleTransaction);
    return () => {
      editor.off("transaction", handleTransaction);
    };
  }, [editor]);

  useEffect(() => {
    if (!open) setSearchInput("");
  }, [open]);

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => searchInputRef.current?.focus());
    }
  }, [open]);

  const updateSearch = (value: string) => {
    setSearchInput(value);
    editor.commands.setSearchTerm(value);
  };
  const updateReplace = (value: string) => editor.commands.setReplaceTerm(value);

  const toggleOption = (command: () => boolean, active: boolean, icon: ReactNode) => (
    <button
      type="button"
      aria-pressed={active}
      onClick={() => command()}
      className={`rounded p-1.5 transition-colors ${active ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}
    >
      {icon}
      {active ? <Check className="h-2.5 w-2.5" /> : null}
    </button>
  );

  return (
    <div
      role="dialog"
      aria-label="Search and replace"
      data-open={open}
      className={`absolute left-4 top-4 z-50 w-80 flex-col gap-2 rounded-xl border border-border bg-background p-3 text-foreground shadow-xl ${open ? "flex" : "hidden"}`}
      onMouseDown={(event) => event.stopPropagation()}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold">Search and replace</span>
        <button type="button" onClick={onClose} className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground" title="Close">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="flex items-center gap-1.5 rounded-md border border-border px-2">
        <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <input
          ref={searchInputRef}
          value={searchInput}
          onChange={(event) => updateSearch(event.target.value)}
          placeholder="Search"
          aria-label="Search"
          autoFocus
          className="min-w-0 flex-1 bg-transparent py-1.5 text-xs outline-none"
        />
        <span className="whitespace-nowrap text-[10px] text-muted-foreground">{currentIndex === null ? 0 : currentIndex + 1} / {results.length}</span>
      </div>
      <div className="flex items-center gap-1.5 rounded-md border border-border px-2">
        <input
          value={replaceTerm}
          onChange={(event) => updateReplace(event.target.value)}
          placeholder="Replace"
          aria-label="Replace"
          className="min-w-0 flex-1 bg-transparent py-1.5 text-xs outline-none"
        />
      </div>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-0.5">
          <span title="Match case">{toggleOption(() => editor.commands.setCaseSensitive(!caseSensitive), caseSensitive, <CaseSensitive className="h-3.5 w-3.5" />)}</span>
          <span title="Whole words">{toggleOption(() => editor.commands.setWholeWord(!wholeWord), wholeWord, <WholeWord className="h-3.5 w-3.5" />)}</span>
          <span title="Use regular expression">{toggleOption(() => editor.commands.setUseRegex(!useRegex), useRegex, <Regex className="h-3.5 w-3.5" />)}</span>
        </div>
        <div className="flex items-center gap-0.5">
          <button type="button" disabled={!results.length} onClick={() => editor.commands.goToPreviousResult()} className="rounded p-1.5 text-muted-foreground hover:bg-accent disabled:opacity-40" title="Previous result">
            <ArrowUp className="h-3.5 w-3.5" />
          </button>
          <button type="button" disabled={!results.length} onClick={() => editor.commands.goToNextResult()} className="rounded p-1.5 text-muted-foreground hover:bg-accent disabled:opacity-40" title="Next result">
            <ArrowDown className="h-3.5 w-3.5" />
          </button>
          <button type="button" disabled={!results.length || !replaceTerm || !editable} onClick={() => editor.commands.replace()} className="rounded px-2 py-1.5 text-[10px] text-muted-foreground hover:bg-accent disabled:opacity-40">
            Replace
          </button>
          <button type="button" disabled={!results.length || !replaceTerm || !editable} onClick={() => editor.commands.replaceAll()} className="rounded px-2 py-1.5 text-[10px] text-muted-foreground hover:bg-accent disabled:opacity-40">
            All
          </button>
        </div>
      </div>
    </div>
  );
}

/** Quick button to insert or focus Document Properties section at the top of the file. */
function AddDocumentPropertiesButton({
  editor,
  filePath = '',
}: {
  editor: Editor;
  filePath?: string;
}) {
  const hasDocProps = useEditorState({
    editor,
    selector: (ctx) => {
      let found = false;
      ctx.editor.state.doc.descendants((node) => {
        if (node.type.name === "documentProperties") {
          found = true;
          return false;
        }
      });
      return found;
    },
  });

  const handleAddProperties = () => {
    // Strictly verify in current ProseMirror doc state before inserting
    let alreadyExists = false;
    editor.state.doc.descendants((node) => {
      if (node.type.name === "documentProperties") {
        alreadyExists = true;
        return false;
      }
    });

    if (alreadyExists || hasDocProps) {
      // Scroll to top of the markdown editor container smoothly
      const scrollContainer =
        editor.view.dom.closest(".scroll-area-viewport, .overflow-y-auto, [data-radix-scroll-area-viewport]") ||
        editor.view.dom.parentElement;
      scrollContainer?.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    const initialMetadata = {
      title: "",
      desc: "",
    };
    const raw = stringifyFrontmatter(initialMetadata);

    editor
      .chain()
      .focus("start")
      .insertContentAt(0, {
        type: "documentProperties",
        attrs: {
          metadata: initialMetadata,
          raw,
          filePath: filePath || "",
        },
      })
      .run();
  };

  return (
    <button
      type="button"
      id="add-document-properties-button"
      onClick={handleAddProperties}
      title={hasDocProps ? "Document properties (Scroll to top)" : "Add document properties"}
      className={`p-2 rounded hover:bg-accent transition-colors ${
        hasDocProps
          ? "text-primary hover:text-primary bg-primary/10"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      <BsCardList className="w-4 h-4" />
    </button>
  );
}

/** Add Comment button with inline Popover for entering comment text. */
function AddCommentButton({
  editor,
  filePath = '',
}: {
  editor: Editor;
  filePath?: string;
}) {
  const [open, setOpen] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [author, setAuthor] = useCommentAuthor();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const addThread = useSetAtom(addCommentThreadAtom);

  // Re-render when selection changes so the disabled state is reactive
  useEditorState({
    editor,
    selector: (ctx) => ctx.transactionNumber,
  });

  const { from, to } = editor.state.selection;
  const hasSelection = from !== to;
  const hasCommentMark = editor.isActive("commentMark");
  const isDisabled = !hasSelection || hasCommentMark;

  // Focus textarea when popover opens
  useEffect(() => {
    if (open) {
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  }, [open]);

  const handleSubmit = () => {
    if (!commentText.trim()) return;

    const finalAuthor = author.trim() || "Me";
    setAuthor(finalAuthor);

    const id = generateCommentId();

    const newThread: CommentThread = {
      id,
      text: commentText.trim(),
      author: finalAuthor,
      createdAt: new Date().toISOString(),
      resolved: false,
      replies: [],
    };

    addThread({
      filePath,
      thread: newThread,
    });

    editor.chain().focus().setCommentMark(id).run();

    setCommentText("");
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === "Escape") {
      setOpen(false);
      setCommentText("");
    }
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (!next) setCommentText("");
        setOpen(next);
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          id="add-comment-button"
          disabled={isDisabled}
          title={
            hasCommentMark
              ? "Selection already has a comment"
              : !hasSelection
                ? "Select text to add a comment"
                : "Add comment"
          }
          className={`p-2 rounded hover:bg-accent transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-muted-foreground hover:text-foreground`}
        >
          <MessageSquarePlus className="w-4 h-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="center"
        side="top"
        className="w-72 p-3 flex flex-col gap-2"
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <div className="flex items-center justify-between gap-1">
          <p className="text-xs font-semibold text-foreground">Add comment</p>
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <span>Posting as:</span>
            <input
              type="text"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="Your name"
              className="px-1.5 py-0.5 rounded border border-border bg-background text-foreground text-[10px] w-24 focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        </div>
        <textarea
          ref={textareaRef}
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Write a comment… (Enter to submit)"
          rows={3}
          className="w-full text-xs resize-none rounded-lg border border-border bg-background px-2.5 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <div className="flex justify-end gap-1.5">
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setCommentText("");
            }}
            className="px-2.5 py-1 rounded-md text-xs text-muted-foreground hover:bg-accent transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!commentText.trim()}
            className="px-3 py-1 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Comment
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function MarkdownBottomMenu({
  editor,
  editable = false,
  size,
  onSizeChange,
  filePath = '',
  isSidebarVisible = false,
  onToggleSidebar,
  isSearchOpen,
  onSearchToggle,
}: MarkdownBottomMenuProps) {
  const commentThreads = useAtomValue(fileCommentThreadsAtomFamily(filePath));
  const openCommentCount = commentThreads.filter((t) => !t.resolved).length;

  return (
    <div className="absolute bottom-4 left-1/2 z-20 flex max-w-[95vw] -translate-x-1/2 items-center gap-1.5 rounded-full border border-border bg-background/85 px-2.5 py-1 shadow-lg backdrop-blur-md select-none overflow-visible">
      {editor && (
        <div className="relative shrink-0">
          <button
            type="button"
            aria-label="Search and replace"
            aria-expanded={isSearchOpen}
            onClick={onSearchToggle}
            className={`rounded p-2 transition-colors ${isSearchOpen ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}
            title="Search and replace (⌘F)"
          >
            <Search className="h-4 w-4" />
          </button>
        </div>
      )}
      {editable && editor && (
        <>
          <div className="flex items-center gap-0.5">
            <BlockButtons editor={editor} />
          </div>
          <div className="w-[1px] h-5 bg-border mx-1 shrink-0 editor-tools-divider" />
        </>
      )}

      {editable && editor && (
        <>
          <AddDocumentPropertiesButton editor={editor} filePath={filePath} />
          <AddCommentButton editor={editor} filePath={filePath} />
          <div className="relative inline-flex items-center">
            <button
              type="button"
              id="toggle-comment-sidebar"
              onClick={onToggleSidebar}
              title={isSidebarVisible ? "Hide comments" : "Show comments"}
              className={`p-2 rounded hover:bg-accent transition-colors relative ${isSidebarVisible
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:text-foreground"
                }`}
            >
              <MessageSquare className="w-4 h-4" />
              {openCommentCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground shadow-xs">
                  {openCommentCount}
                </span>
              )}
            </button>
          </div>
          <div className="w-[1px] h-5 bg-border mx-1 shrink-0 size-control-divider" />
        </>
      )}

      <div className="size-control-expanded items-center gap-0.5 shrink-0">
        <MarkdownSizeControl
          size={size}
          onSizeChange={onSizeChange}
          className="flex items-center gap-0.5 shrink-0"
        />
      </div>

      <div className="size-control-dropdown items-center shrink-0">
        <MarkdownSizeDropdown
          size={size}
          onSizeChange={onSizeChange}
        />
      </div>
    </div>
  );
}
