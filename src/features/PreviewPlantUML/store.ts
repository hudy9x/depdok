import { atom } from 'jotai';

/**
 * When set to a non-null value, MonacoEditor should jump to the given line number
 * and then reset this atom back to null.
 */
export const plantUMLJumpAtom = atom<{ lineNumber: number } | null>(null);
