import { useRef, useState, useEffect } from "react";
import { Editor, useEditorState } from "@tiptap/react";
import { MessageSquare, MessageSquarePlus } from "lucide-react";
import { useAtom, useSetAtom } from "jotai";

import { BlockButtons } from "./MenuButtons";
import { MarkdownSizeControl, MarkdownSizeDropdown, type MarkdownEditorSize } from "./MarkdownSizeControl";
import { ExportButton } from "./ExportButton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  addCommentThreadAtom,
  commentSidebarVisibleAtom,
} from "@/stores/commentStore";
import { generateCommentId } from "@/lib/commentParser";

interface MarkdownBottomMenuProps {
  editor: Editor | null;
  editable?: boolean;
  size: MarkdownEditorSize;
  onSizeChange: (size: MarkdownEditorSize) => void;
  filePath?: string;
}

/** Add Comment button with inline Popover for entering comment text. */
function AddCommentButton({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false);
  const [commentText, setCommentText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const addThread = useSetAtom(addCommentThreadAtom);
  const setSidebarVisible = useSetAtom(commentSidebarVisibleAtom);

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

    const id = generateCommentId();
    editor.chain().focus().setCommentMark(id).run();

    addThread({
      id,
      text: commentText.trim(),
      author: "Me",
      createdAt: new Date().toISOString(),
      resolved: false,
      replies: [],
    });

    setSidebarVisible(true);
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
        <p className="text-xs font-semibold text-foreground">Add comment</p>
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
  filePath,
}: MarkdownBottomMenuProps) {
  const [isSidebarVisible, setSidebarVisible] = useAtom(commentSidebarVisibleAtom);

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 rounded-full border border-border bg-background/85 backdrop-blur-md px-2.5 py-1 shadow-lg max-w-[95vw] select-none overflow-x-auto">
      {editable && editor && (
        <>
          <div className="flex items-center gap-0.5">
            <BlockButtons editor={editor} />
          </div>
          <div className="w-[1px] h-5 bg-border mx-1 shrink-0 editor-tools-divider" />
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
      {editor && (
        <div className="export-button-group items-center shrink-0">
          <div className="w-[1px] h-5 bg-border mx-1 shrink-0" />
          <ExportButton editor={editor} filePath={filePath} />
        </div>
      )}
      {editable && editor && (
        <>
          <div className="w-[1px] h-5 bg-border mx-1 shrink-0" />
          <AddCommentButton editor={editor} />
          <button
            type="button"
            id="toggle-comment-sidebar"
            onClick={() => setSidebarVisible((v) => !v)}
            title={isSidebarVisible ? "Hide comments" : "Show comments"}
            className={`p-2 rounded hover:bg-accent transition-colors ${
              isSidebarVisible
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <MessageSquare className="w-4 h-4" />
          </button>
        </>
      )}
    </div>
  );
}
