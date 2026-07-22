import { useState } from 'react';

const STORAGE_KEY = 'depdok-comment-username';

export function getSavedCommentAuthor(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) || 'Me';
  } catch {
    return 'Me';
  }
}

export function saveCommentAuthor(name: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, name);
  } catch {
    // ignore
  }
}

export function useCommentAuthor() {
  const [author, setAuthorState] = useState<string>(getSavedCommentAuthor);

  const setAuthor = (newAuthor: string) => {
    setAuthorState(newAuthor);
    saveCommentAuthor(newAuthor);
  };

  return [author, setAuthor] as const;
}
