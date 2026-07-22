import { useState } from 'react';
import { Check, ChevronDown, ChevronUp, MessageSquare, MoreHorizontal, Reply, Trash2 } from 'lucide-react';
import { useSetAtom } from 'jotai';
import { formatDistanceToNow } from 'date-fns';

import {
  addCommentReplyAtom,
  deleteCommentReplyAtom,
  deleteCommentThreadAtom,
  toggleCommentResolvedAtom,
  updateCommentTextAtom,
  type CommentThread,
} from './commentStore';
import { generateCommentId } from './commentParser';
import { useCommentAuthor } from './useCommentAuthor';

import { Editor } from '@tiptap/react';

interface CommentThreadProps {
  thread: CommentThread;
  isActive: boolean;
  onClick: () => void;
  onDeleteMark: (id: string) => void;
  editor?: Editor | null;
}

function formatDate(iso: string): string {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true });
  } catch {
    return iso;
  }
}

export function CommentThreadCard({
  thread,
  isActive,
  onClick,
  onDeleteMark,
  editor,
}: CommentThreadProps) {
  const [author, setAuthor] = useCommentAuthor();
  const [replyText, setReplyText] = useState('');
  const [isReplying, setIsReplying] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(thread.text);
  const [repliesExpanded, setRepliesExpanded] = useState(true);

  const addReply = useSetAtom(addCommentReplyAtom);
  const deleteThread = useSetAtom(deleteCommentThreadAtom);
  const deleteReply = useSetAtom(deleteCommentReplyAtom);
  const toggleResolved = useSetAtom(toggleCommentResolvedAtom);
  const updateText = useSetAtom(updateCommentTextAtom);

  const handleSaveEdit = () => {
    if (editText.trim()) {
      updateText({ id: thread.id, text: editText.trim() });
    }
    setIsEditing(false);
  };

  const handleAddReply = () => {
    if (!replyText.trim()) return;
    const finalAuthor = author.trim() || 'Me';
    setAuthor(finalAuthor);

    addReply({
      threadId: thread.id,
      reply: {
        id: generateCommentId(),
        text: replyText.trim(),
        author: finalAuthor,
        createdAt: new Date().toISOString(),
      },
    });
    setReplyText('');
    setIsReplying(false);
  };

  const handleDelete = () => {
    onDeleteMark(thread.id);
    deleteThread(thread.id);
  };

  const handleToggleResolve = () => {
    if (!thread.resolved && editor) {
      editor.chain().focus().unsetCommentMark(thread.id).run();
    }
    toggleResolved(thread.id);
  };

  return (
    <div
      onClick={onClick}
      className={`
        group relative rounded-xl border transition-all duration-200 cursor-pointer
        ${isActive
          ? 'border-primary bg-card'
          : 'border-border bg-card hover:border-border/80 hover:bg-accent/30'
        }
        ${thread.resolved ? 'opacity-60' : ''}
      `}
    >
      <div className="p-3">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-xs font-semibold text-foreground truncate">
              {thread.author}
            </span>
            <span className="text-[10px] text-muted-foreground shrink-0">
              {formatDate(thread.createdAt)}
            </span>
          </div>

          {/* Actions */}
          <div
            className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={handleToggleResolve}
              title={thread.resolved ? 'Reopen' : 'Resolve'}
              className="p-1 rounded hover:bg-accent transition-colors text-muted-foreground hover:text-green-600 dark:hover:text-green-400"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => { setIsEditing(true); setEditText(thread.text); }}
              title="Edit comment"
              className="p-1 rounded hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
            >
              <MoreHorizontal className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleDelete}
              title="Delete comment"
              className="p-1 rounded hover:bg-accent transition-colors text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Resolved badge */}
        {thread.resolved && (
          <div className="flex items-center gap-1 mb-1.5">
            <span className="text-[10px] font-medium text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-1.5 py-0.5 rounded-full">
              Resolved
            </span>
          </div>
        )}

        {/* Comment body */}
        {isEditing ? (
          <div className="space-y-1.5" onClick={(e) => e.stopPropagation()}>
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              autoFocus
              rows={3}
              className="w-full text-xs resize-none rounded-lg border border-border bg-background px-2 py-1.5 text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSaveEdit(); }
                if (e.key === 'Escape') setIsEditing(false);
              }}
            />
            <div className="flex gap-1.5 justify-end">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-accent rounded transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                className="px-2 py-0.5 text-[11px] font-medium bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        ) : (
          <p className="text-xs text-foreground leading-relaxed break-words">
            {thread.text}
          </p>
        )}

        {/* Replies section */}
        {thread.replies.length > 0 && (
          <div className="mt-2.5">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setRepliesExpanded((v) => !v); }}
              className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors mb-1.5"
            >
              <MessageSquare className="w-3 h-3" />
              <span>{thread.replies.length} {thread.replies.length === 1 ? 'reply' : 'replies'}</span>
              {repliesExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>

            {repliesExpanded && (
              <div className="border-l-2 border-border pl-3 space-y-2 mt-1">
                {thread.replies.map((reply) => (
                  <div key={reply.id} className="group/reply flex items-start justify-between gap-1">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-[10px] font-semibold text-foreground">{reply.author}</span>
                        <span className="text-[10px] text-muted-foreground">{formatDate(reply.createdAt)}</span>
                      </div>
                      <p className="text-xs text-foreground leading-relaxed break-words">{reply.text}</p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); deleteReply({ threadId: thread.id, replyId: reply.id }); }}
                      className="opacity-0 group-hover/reply:opacity-100 p-0.5 rounded hover:bg-accent text-muted-foreground hover:text-destructive transition-all shrink-0"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Reply input */}
        {isReplying ? (
          <div
            className="mt-2 space-y-1.5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-1 text-[10px] text-muted-foreground">
              <span>Replying as:</span>
              <input
                type="text"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="Your name"
                className="px-1.5 py-0.5 rounded border border-border bg-background text-foreground text-[10px] w-28 focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              autoFocus
              rows={2}
              placeholder="Write a reply…"
              className="w-full text-xs resize-none rounded-lg border border-border bg-background px-2 py-1.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddReply(); }
                if (e.key === 'Escape') setIsReplying(false);
              }}
            />
            <div className="flex gap-1.5 justify-end">
              <button
                type="button"
                onClick={() => setIsReplying(false)}
                className="px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-accent rounded transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddReply}
                disabled={!replyText.trim()}
                className="px-2 py-0.5 text-[11px] font-medium bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                Reply
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setIsReplying(true); }}
            className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <Reply className="w-3 h-3" />
            <span>Reply</span>
          </button>
        )}
      </div>
    </div>
  );
}
