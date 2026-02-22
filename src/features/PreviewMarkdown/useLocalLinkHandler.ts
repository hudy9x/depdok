import { useEffect, useCallback, type RefObject } from "react";
import { useSetAtom } from "jotai";
import { useNavigate } from "react-router-dom";
import { createTabAtom } from "@/stores/TabStore";
import type { EditorView } from "@tiptap/pm/view";
import { openUrl } from "@tauri-apps/plugin-opener";

/** Resolves a relative href against a base file path (handles ./, ../, bare names). */
function resolveLocalPath(basePath: string, href: string): string {
  const dir = basePath.substring(0, basePath.lastIndexOf('/'));
  const parts = dir.split('/');
  for (const seg of href.split('/')) {
    if (seg === '..') parts.pop();
    else if (seg !== '.') parts.push(seg);
  }
  return parts.join('/');
}

/** Returns true if href is a local file path (not http/https/mailto/#). */
function isLocalPath(href: string): boolean {
  return !href.startsWith('http://') &&
    !href.startsWith('https://') &&
    !href.startsWith('mailto:') &&
    !href.startsWith('#');
}

/**
 * Intercepts ALL anchor clicks on `container` in the capture phase,
 * before Tauri's webview can open the system browser.
 *
 * - Local paths  → open as preview tabs
 * - HTTP(S) URLs → opened in system browser via window.open
 * - #anchors / mailto: → ignored (default behaviour)
 *
 * Also returns a ProseMirror `handleClick` to prevent cursor placement
 * when clicking links in editable mode.
 */
export function useLocalLinkHandler(
  currentFilePath: string | null,
  containerRef: RefObject<HTMLElement | null>,
) {
  const createTab = useSetAtom(createTabAtom);
  const navigate = useNavigate();

  const openLink = useCallback(
    (href: string) => {
      if (!isLocalPath(href)) {
        openUrl(href);
        return;
      }
      if (!currentFilePath) return;
      const resolved = resolveLocalPath(currentFilePath, href);
      const fileName = resolved.split('/').pop() || 'Untitled';
      createTab({ filePath: resolved, fileName, switchTo: true, isPreview: true });
      navigate('/editor');
    },
    [currentFilePath, createTab, navigate]
  );

  // Capture-phase DOM listener — fires before Tauri intercepts the <a> click
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleAnchorClick = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest('a[href]');
      if (!anchor) return;
      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('mailto:')) return;

      e.preventDefault();
      e.stopPropagation();
      openLink(href);
    };

    container.addEventListener('click', handleAnchorClick, true);
    return () => container.removeEventListener('click', handleAnchorClick, true);
  }, [containerRef, openLink]);

  // ProseMirror handleClick — prevents cursor placement on link clicks in edit mode
  return useCallback(
    (view: EditorView, pos: number, event: MouseEvent): boolean => {
      const { state } = view;
      const resolvedPos = state.doc.resolve(pos);
      const marks = [
        ...resolvedPos.marks(),
        ...(pos > 0 ? state.doc.resolve(pos - 1).marks() : []),
      ];
      const linkMark = marks.find(m => m.type.name === 'link');
      if (!linkMark) return false;
      const href = linkMark.attrs['href'] as string | undefined;
      if (!href) return false;
      event.preventDefault();
      return true; // DOM capture listener handles the actual navigation
    },
    []
  );
}
