import { atom } from 'jotai';
import { atomFamily } from 'jotai/utils';

export const dirtyFilesAtom = atom<Set<string>>(new Set<string>());

export const markFileAsDirtyAtom = atom(null, (get, set, filePath: string) => {
  const previous = get(dirtyFilesAtom);
  if (previous.has(filePath)) return;

  const next = new Set(previous);
  next.add(filePath);
  set(dirtyFilesAtom, next);
});

export const markFileAsSavedAtom = atom(null, (get, set, filePath: string) => {
  const previous = get(dirtyFilesAtom);
  if (!previous.has(filePath)) return;

  const next = new Set(previous);
  next.delete(filePath);
  set(dirtyFilesAtom, next);
});

export const isFileDirtyAtom = atomFamily((filePath: string) =>
  atom((get) => get(dirtyFilesAtom).has(filePath))
);