import { useState } from 'react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { MessageSquare, X } from 'lucide-react';
import { Editor } from '@tiptap/react';

import {
  activeCommentIdAtom,
  commentSidebarVisibleAtom,
  commentThreadsAtom,
} from './commentStore';
import { CommentThreadCard } from './CommentThread';

interface CommentSidebarProps {
  editor: Editor | null;
}

/**
 * Sidebar panel showing all comment threads for the current document.
 * Includes a filter switcher for Open vs Resolved comments.
 */
export function CommentSidebar({ editor }: CommentSidebarProps) {
  const threads = useAtomValue(commentThreadsAtom);
  const [activeId, setActiveId] = useAtom(activeCommentIdAtom);
  const setSidebarVisible = useSetAtom(commentSidebarVisibleAtom);
  const [filterTab, setFilterTab] = useState<'open' | 'resolved'>('open');

  const activeThreads = threads.filter((t) => !t.resolved);
  const resolvedThreads = threads.filter((t) => t.resolved);
  const currentThreads = filterTab === 'open' ? activeThreads : resolvedThreads;

  const handleThreadClick = (id: string) => {
    setActiveId(id);

    if (!editor) return;

    // Scroll the editor to the comment mark and highlight it
    const { doc } = editor.state;
    let found = false;

    doc.descendants((node, pos) => {
      if (found || !node.isInline) return;
      node.marks.forEach((mark) => {
        if (
          !found &&
          mark.type.name === 'commentMark' &&
          mark.attrs.commentId === id
        ) {
          found = true;
          // Set selection to the mark range so it scrolls into view
          editor.chain().focus().setTextSelection(pos).run();

          // After a tick, scroll the mark into the viewport
          setTimeout(() => {
            const view = editor.view;
            const domPos = view.domAtPos(pos);
            const el = domPos.node instanceof Element
              ? domPos.node
              : domPos.node.parentElement;
            el?.closest('[data-comment-id]')?.scrollIntoView({
              behavior: 'smooth',
              block: 'center',
            });
          }, 50);
        }
      });
    });
  };

  const handleDeleteMark = (id: string) => {
    if (!editor) return;
    editor.chain().focus().unsetCommentMark(id).run();
  };

  const openCount = activeThreads.length;

  return (
    <div className="comment-sidebar flex flex-col h-full border-border bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">Comments</span>
          {openCount > 0 && (
            <span className="text-[10px] font-medium bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
              {openCount}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setSidebarVisible(false)}
          className="p-1 rounded hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
          title="Close comments"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Filter Switcher (Open | Resolved) */}
      <div className="flex items-center p-1 bg-muted/40 border-b border-border text-xs shrink-0">
        <button
          type="button"
          onClick={() => setFilterTab('open')}
          className={`flex-1 py-1 text-center rounded-md font-medium transition-colors text-[11px] ${
            filterTab === 'open'
              ? 'bg-background text-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Open ({activeThreads.length})
        </button>
        <button
          type="button"
          onClick={() => setFilterTab('resolved')}
          className={`flex-1 py-1 text-center rounded-md font-medium transition-colors text-[11px] ${
            filterTab === 'resolved'
              ? 'bg-background text-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Resolved ({resolvedThreads.length})
        </button>
      </div>

      {/* Thread list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {currentThreads.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-center gap-3">
            <div className="w-10 h-10 rounded-full bg-muted/60 flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">
                {filterTab === 'open' ? 'No open comments' : 'No resolved comments'}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {filterTab === 'open'
                  ? 'Select text in the editor to add a comment.'
                  : 'Resolved comments will appear here.'}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {currentThreads.map((thread) => (
              <CommentThreadCard
                key={thread.id}
                thread={thread}
                isActive={activeId === thread.id}
                onClick={() => handleThreadClick(thread.id)}
                onDeleteMark={handleDeleteMark}
                editor={editor}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
