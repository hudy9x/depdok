import { useRef, useState, useEffect } from "react";
import { Editor, useEditorState } from "@tiptap/react";
import { MessageSquare, MessageSquarePlus } from "lucide-react";
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
}: MarkdownBottomMenuProps) {
  const commentThreads = useAtomValue(fileCommentThreadsAtomFamily(filePath));
  const openCommentCount = commentThreads.filter((t) => !t.resolved).length;

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
