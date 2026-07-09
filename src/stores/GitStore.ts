import { atom } from 'jotai';

/**
 * Stores the Git status map for the current workspace.
 * Key: Absolute file/directory path
 * Value: Git status string ("modified", "added", "untracked", "deleted", "renamed", etc.)
 */
export const gitStatusAtom = atom<Record<string, string>>({});
