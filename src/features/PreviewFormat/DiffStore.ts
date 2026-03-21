import { atomWithStorage } from 'jotai/utils';

export type DiffMode = 'lines' | 'words' | 'chars';

export const diffModeAtom = atomWithStorage<DiffMode>('depdok-format-diff-mode', 'words');
