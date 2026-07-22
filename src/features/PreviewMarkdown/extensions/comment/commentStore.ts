import { atom } from 'jotai';

export interface CommentReply {
  id: string;
  text: string;
  author: string;
  createdAt: string;
}

export interface CommentThread {
  id: string;
  text: string;
  author: string;
  createdAt: string;
  resolved: boolean;
  replies: CommentReply[];
}

// All comment threads for the current file
export const commentThreadsAtom = atom<CommentThread[]>([]);

// The currently active/focused comment id (for bidirectional highlighting)
export const activeCommentIdAtom = atom<string | null>(null);

// Whether the comment sidebar is visible
export const commentSidebarVisibleAtom = atom<boolean>(false);

// Write atom to add a new comment thread
export const addCommentThreadAtom = atom(
  null,
  (_get, set, thread: CommentThread) => {
    set(commentThreadsAtom, (prev) => [...prev, thread]);
    set(activeCommentIdAtom, thread.id);
  }
);

// Write atom to update a comment thread's text
export const updateCommentTextAtom = atom(
  null,
  (_get, set, payload: { id: string; text: string }) => {
    set(commentThreadsAtom, (prev) =>
      prev.map((t) => (t.id === payload.id ? { ...t, text: payload.text } : t))
    );
  }
);

// Write atom to add a reply to a comment thread
export const addCommentReplyAtom = atom(
  null,
  (_get, set, payload: { threadId: string; reply: CommentReply }) => {
    set(commentThreadsAtom, (prev) =>
      prev.map((t) =>
        t.id === payload.threadId
          ? { ...t, replies: [...t.replies, payload.reply] }
          : t
      )
    );
  }
);

// Write atom to resolve/unresolve a comment thread
export const toggleCommentResolvedAtom = atom(
  null,
  (_get, set, id: string) => {
    set(commentThreadsAtom, (prev) =>
      prev.map((t) => (t.id === id ? { ...t, resolved: !t.resolved } : t))
    );
  }
);

// Write atom to delete a comment thread
export const deleteCommentThreadAtom = atom(
  null,
  (_get, set, id: string) => {
    set(commentThreadsAtom, (prev) => prev.filter((t) => t.id !== id));
    set(activeCommentIdAtom, (prev) => (prev === id ? null : prev));
  }
);

// Write atom to delete a reply
export const deleteCommentReplyAtom = atom(
  null,
  (_get, set, payload: { threadId: string; replyId: string }) => {
    set(commentThreadsAtom, (prev) =>
      prev.map((t) =>
        t.id === payload.threadId
          ? { ...t, replies: t.replies.filter((r) => r.id !== payload.replyId) }
          : t
      )
    );
  }
);
