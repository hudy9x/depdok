import { useState, useRef, useEffect, useCallback } from 'react';
import { Editor } from '@tiptap/react';
import { MessageSquarePlus } from 'lucide-react';
import { useSetAtom } from 'jotai';

import {
  addCommentThreadAtom,
  commentSidebarVisibleAtom,
} from '@/stores/commentStore';
import { generateCommentId } from '@/lib/commentParser';

interface AddCommentBubbleProps {
  editor: Editor;
}

/**
 * A floating bubble that appears above the text selection to let users add comments.
 * It positions itself based on the selection's bounding rect.
 */
export function AddCommentBubble({ editor }: AddCommentBubbleProps) {
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [commentText, setCommentText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);

  const addThread = useSetAtom(addCommentThreadAtom);
  const setSidebarVisible = useSetAtom(commentSidebarVisibleAtom);

  const updateBubblePosition = useCallback(() => {
    const { from, to } = editor.state.selection;
    const hasSelection = from !== to;
    const hasCommentMark = editor.isActive('commentMark');

    if (!hasSelection || hasCommentMark) {
      setPosition(null);
      setIsOpen(false);
      return;
    }

    try {
      const startCoords = editor.view.coordsAtPos(from);
      const endCoords = editor.view.coordsAtPos(to);

      const editorDom = editor.view.dom;
      const editorRect = editorDom.getBoundingClientRect();
      const scrollEl = editorDom.closest('.markdown-editor-scroll') ?? document.documentElement;
      const scrollTop = scrollEl.scrollTop ?? 0;

      const midX = (startCoords.left + endCoords.right) / 2 - editorRect.left;
      const top = startCoords.top - editorRect.top + scrollTop - 48;

      setPosition({ top, left: midX });
    } catch {
      setPosition(null);
    }
  }, [editor]);

  // Listen to editor selection changes
  useEffect(() => {
    const handleSelectionUpdate = () => {
      if (!isOpen) updateBubblePosition();
    };

    editor.on('selectionUpdate', handleSelectionUpdate);
    editor.on('transaction', handleSelectionUpdate);

    return () => {
      editor.off('selectionUpdate', handleSelectionUpdate);
      editor.off('transaction', handleSelectionUpdate);
    };
  }, [editor, isOpen, updateBubblePosition]);

  // Close bubble when clicking outside
  useEffect(() => {
    if (!isOpen) return;
    const handleMouseDown = (e: MouseEvent) => {
      if (bubbleRef.current && !bubbleRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setCommentText('');
        setPosition(null);
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [isOpen]);

  // Focus textarea when popover opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const handleAddComment = () => {
    if (!commentText.trim()) return;

    const id = generateCommentId();
    const now = new Date().toISOString();

    editor.chain().focus().setCommentMark(id).run();

    addThread({
      id,
      text: commentText.trim(),
      author: 'Me',
      createdAt: now,
      resolved: false,
      replies: [],
    });

    setSidebarVisible(true);
    setCommentText('');
    setIsOpen(false);
    setPosition(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAddComment();
    }
    if (e.key === 'Escape') {
      setIsOpen(false);
      setCommentText('');
      setPosition(null);
    }
  };

  if (!position) return null;

  return (
    <div
      ref={bubbleRef}
      style={{
        position: 'absolute',
        top: `${position.top}px`,
        left: `${position.left}px`,
        transform: 'translateX(-50%)',
        zIndex: 50,
      }}
      onMouseDown={(e) => e.preventDefault()}
    >
      {!isOpen ? (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-popover border border-border shadow-lg text-xs font-medium text-foreground hover:bg-accent transition-all duration-150 whitespace-nowrap"
          title="Add comment"
        >
          <MessageSquarePlus className="w-3.5 h-3.5" />
          <span>Comment</span>
        </button>
      ) : (
        <div className="bg-popover border border-border rounded-xl shadow-xl p-3 w-72 flex flex-col gap-2">
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
                setIsOpen(false);
                setCommentText('');
                setPosition(null);
              }}
              className="px-2.5 py-1 rounded-md text-xs text-muted-foreground hover:bg-accent transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAddComment}
              disabled={!commentText.trim()}
              className="px-3 py-1 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Comment
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
