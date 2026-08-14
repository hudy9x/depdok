import { atom } from 'jotai';
import { atomFamily } from 'jotai/utils';

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

// All comment threads for a specific file path
export const fileCommentThreadsAtomFamily = atomFamily((_filePath: string) =>
  atom<CommentThread[]>([])
);

// The currently active/focused comment id per file path
export const fileActiveCommentIdAtomFamily = atomFamily((_filePath: string) =>
  atom<string | null>(null)
);

// Write atom to add a new comment thread
export const addCommentThreadAtom = atom(
  null,
  (_get, set, payload: { filePath: string; thread: CommentThread }) => {
    set(fileCommentThreadsAtomFamily(payload.filePath), (prev) => [...prev, payload.thread]);
    set(fileActiveCommentIdAtomFamily(payload.filePath), payload.thread.id);
  }
);

// Write atom to update a comment thread's text
export const updateCommentTextAtom = atom(
  null,
  (_get, set, payload: { filePath: string; id: string; text: string }) => {
    set(fileCommentThreadsAtomFamily(payload.filePath), (prev) =>
      prev.map((t) => (t.id === payload.id ? { ...t, text: payload.text } : t))
    );
  }
);

// Write atom to add a reply to a comment thread
export const addCommentReplyAtom = atom(
  null,
  (_get, set, payload: { filePath: string; threadId: string; reply: CommentReply }) => {
    set(fileCommentThreadsAtomFamily(payload.filePath), (prev) =>
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
  (_get, set, payload: { filePath: string; id: string }) => {
    set(fileCommentThreadsAtomFamily(payload.filePath), (prev) =>
      prev.map((t) => (t.id === payload.id ? { ...t, resolved: !t.resolved } : t))
    );
  }
);

// Write atom to delete a comment thread
export const deleteCommentThreadAtom = atom(
  null,
  (_get, set, payload: { filePath: string; id: string }) => {
    set(fileCommentThreadsAtomFamily(payload.filePath), (prev) => prev.filter((t) => t.id !== payload.id));
    set(fileActiveCommentIdAtomFamily(payload.filePath), (prev) => (prev === payload.id ? null : prev));
  }
);

// Write atom to delete a reply
export const deleteCommentReplyAtom = atom(
  null,
  (_get, set, payload: { filePath: string; threadId: string; replyId: string }) => {
    set(fileCommentThreadsAtomFamily(payload.filePath), (prev) =>
      prev.map((t) =>
        t.id === payload.threadId
          ? { ...t, replies: t.replies.filter((r) => r.id !== payload.replyId) }
          : t
      )
    );
  }
);
