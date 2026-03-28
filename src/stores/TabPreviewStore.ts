import { atom } from 'jotai';

// Store base64 image strings mapped by tab ID
export const tabPreviewsAtom = atom<Record<string, string>>({});

// Setter atom to update a specific tab's preview
export const setTabPreviewAtom = atom(
  null,
  (get, set, payload: { tabId: string; dataUrl: string }) => {
    const current = get(tabPreviewsAtom);
    set(tabPreviewsAtom, { ...current, [payload.tabId]: payload.dataUrl });
  }
);
