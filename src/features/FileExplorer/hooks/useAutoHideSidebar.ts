import { useEffect, useRef } from 'react';
import { useAtom, useAtomValue } from 'jotai';
import { isFileExplorerAutoHoverAtom, isFileExplorerVisibleAtom } from '../store';

const EDGE_TRIGGER_DISTANCE = 20; // pixels from left edge to trigger show

export function useAutoHideSidebar() {
  const [isAutoHover, setIsAutoHover] = useAtom(isFileExplorerAutoHoverAtom);
  const isVisible = useAtomValue(isFileExplorerVisibleAtom);
  const sidebarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Only enable auto-hide when FileExplorer is hidden
    if (isVisible) {
      setIsAutoHover(false);
      return;
    }

    let rafId: number | null = null;
    let isMouseOverSidebar = false;

    const handleMouseMove = (e: MouseEvent) => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }

      rafId = requestAnimationFrame(() => {
        const { clientX } = e;

        // Check if mouse is near left edge
        const isNearEdge = clientX <= EDGE_TRIGGER_DISTANCE;

        // Check if mouse is over the sidebar area
        if (sidebarRef.current) {
          const rect = sidebarRef.current.getBoundingClientRect();
          isMouseOverSidebar =
            clientX >= rect.left &&
            clientX <= rect.right &&
            e.clientY >= rect.top &&
            e.clientY <= rect.bottom;
        }

        // Show if near edge or over sidebar, hide otherwise
        const shouldShow = isNearEdge || isMouseOverSidebar;

        if (shouldShow !== isAutoHover) {
          setIsAutoHover(shouldShow);
        }

        rafId = null;
      });
    };

    window.addEventListener('mousemove', handleMouseMove);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
    };
  }, [isVisible, isAutoHover, setIsAutoHover]);

  return { sidebarRef, isAutoHover };
}
