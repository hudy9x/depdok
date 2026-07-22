import { useAtomValue } from "jotai";
import { Editor } from "@tiptap/react";
import { commentSidebarVisibleAtom } from "./commentStore";
import { CommentSidebar } from "./CommentSidebar";

interface MarkdownCommentSidebarProps {
  editor: Editor | null;
}

/**
 * Wrapper component for the CommentSidebar panel.
 * Controls sidebar visibility from the Jotai store.
 */
export function MarkdownCommentSidebar({ editor }: MarkdownCommentSidebarProps) {
  const isSidebarVisible = useAtomValue(commentSidebarVisibleAtom);

  if (!isSidebarVisible) return null;

  return (
    <div className="comment-sidebar-panel w-72 shrink-0 h-full overflow-hidden">
      <CommentSidebar editor={editor} />
    </div>
  );
}
