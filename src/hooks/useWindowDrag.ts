import { useEffect, useRef } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';

/**
 * Hook to enable window dragging on an element.
 * 
 * @param selector Optional CSS selector to find the element. If not provided, returns a ref to attach.
 * @returns RefObject to attach to the element if no selector is provided.
 */
export function useWindowDrag(selector?: string) {
  const elementRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const appWindow = getCurrentWindow();
    const targetElement = selector
      ? document.querySelector(selector) as HTMLElement
      : elementRef.current;

    if (!targetElement) return;

    const handleMouseDown = (e: Event) => {
      const mouseEvent = e as MouseEvent;
      // Prevent dragging if clicking on interactive elements (like close buttons or tabs)
      // Also prevent dragging on scrollbar components
      const target = mouseEvent.target as HTMLElement;
      if (
        target.closest('[data-tauri-drag-region="false"]') ||
        target.closest('[data-slot="scroll-area-thumb"]') ||
        target.closest('[data-slot="scroll-area-scrollbar"]')
      ) {
        return;
      }

      if (mouseEvent.buttons === 1) {
        mouseEvent.detail === 2
          ? appWindow.toggleMaximize()
          : appWindow.startDragging();
      }
    };

    targetElement.addEventListener('mousedown', handleMouseDown);

    return () => {
      targetElement.removeEventListener('mousedown', handleMouseDown);
    };
  }, [selector]);

  return elementRef;
}
