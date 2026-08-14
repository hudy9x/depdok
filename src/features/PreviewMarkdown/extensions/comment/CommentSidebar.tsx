import { useState, useEffect } from 'react';
import { useAtom, useAtomValue } from 'jotai';
import { MessageSquare, X } from 'lucide-react';
import { Editor } from '@tiptap/react';

import {
  fileActiveCommentIdAtomFamily,
  fileCommentThreadsAtomFamily,
} from './commentStore';
import { CommentThreadCard } from './CommentThread';

interface CommentSidebarProps {
  editor: Editor | null;
  onClose?: () => void;
  filePath?: string;
}

/**
 * Sidebar panel showing all comment threads for the current document.
 * Includes a filter switcher for Open vs Resolved comments.
 */
export function CommentSidebar({ editor, onClose, filePath = '' }: CommentSidebarProps) {
  const threads = useAtomValue(fileCommentThreadsAtomFamily(filePath));
  const [activeId, setActiveId] = useAtom(fileActiveCommentIdAtomFamily(filePath));
  const [filterTab, setFilterTab] = useState<'open' | 'resolved'>('open');

  const activeThreads = threads.filter((t) => !t.resolved);
  const resolvedThreads = threads.filter((t) => t.resolved);
  const currentThreads = filterTab === 'open' ? activeThreads : resolvedThreads;

  const handleThreadClick = (id: string) => {
    setActiveId(id);

    if (!editor) return;

    // Apply active class to all matching comment marks immediately in the editor DOM
    editor.view.dom.querySelectorAll<HTMLElement>('.comment-mark').forEach((el) => {
      const match = el.getAttribute('data-comment-id') === id;
      el.classList.toggle('comment-mark-active', match);
      if (match) {
        el.setAttribute('data-active', 'true');
      } else {
        el.removeAttribute('data-active');
      }
    });

    // 1. Direct DOM lookup for smooth, reliable scrolling
    const markEl = editor.view.dom.querySelector<HTMLElement>(`[data-comment-id="${id}"]`);
    if (markEl) {
      markEl.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }

    // 2. Also set ProseMirror text selection to the mark position
    const { doc } = editor.state;
    let markPos: number | null = null;

    doc.descendants((node, pos) => {
      if (markPos !== null || !node.isInline) return;
      node.marks.forEach((mark) => {
        if (
          markPos === null &&
          mark.type.name === 'commentMark' &&
          mark.attrs.commentId === id
        ) {
          markPos = pos;
        }
      });
    });

    if (markPos !== null) {
      editor.chain().setTextSelection(markPos).run();
    }
  };

  // Auto-scroll the active thread card into view in the sidebar whenever activeId changes
  useEffect(() => {
    if (!activeId) return;
    const cardEl = document.querySelector<HTMLElement>(`[data-thread-card-id="${activeId}"]`);
    if (cardEl) {
      cardEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [activeId]);

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
          onClick={onClose}
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
                filePath={filePath}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
