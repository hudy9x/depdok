import { Editor } from "@tiptap/react";
import { CommentSidebar } from "./CommentSidebar";

interface MarkdownCommentSidebarProps {
  editor: Editor | null;
  visible?: boolean;
  onClose?: () => void;
}

/**
 * Wrapper component for the CommentSidebar panel.
 * Controls sidebar visibility per view instance.
 */
export function MarkdownCommentSidebar({ editor, visible, onClose }: MarkdownCommentSidebarProps) {
  if (!visible) return null;

  return (
    <div className="comment-sidebar-panel w-72 shrink-0 h-full overflow-hidden">
      <CommentSidebar editor={editor} onClose={onClose} />
    </div>
  );
}
