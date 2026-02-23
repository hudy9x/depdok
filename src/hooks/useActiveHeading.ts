import { useState, useEffect } from 'react';

interface AnchorWithDom {
  id: string;
  dom: HTMLElement;
}

/**
 * Tracks the active heading by listening to scroll events on a container.
 * Uses anchor.dom directly (the actual DOM element from TipTap's TOC anchor)
 * instead of document.getElementById, because TipTap uses UUIDs as anchor IDs
 * which differ from the slug-based IDs on the heading DOM elements.
 *
 * @param anchors - Array of {id, dom} objects from TipTap TOC anchors
 * @param scrollContainer - The element that actually scrolls (defaults to window)
 * @param threshold - How many px past the top counts as "active" (default 80)
 */
export function useActiveHeading(
  anchors: AnchorWithDom[],
  scrollContainer?: HTMLElement | null,
  threshold = 80,
): string | null {
  const [activeHeadingId, setActiveHeadingId] = useState<string | null>(null);

  useEffect(() => {
    if (anchors.length === 0) return;

    const findActive = () => {
      const containerTop = scrollContainer
        ? scrollContainer.getBoundingClientRect().top
        : 0;

      let activeId: string | null = null;

      for (const anchor of anchors) {
        if (!anchor.dom) continue;
        const relativeTop = anchor.dom.getBoundingClientRect().top - containerTop;

        if (relativeTop <= threshold) {
          activeId = anchor.id;
        } else {
          break;
        }
      }

      setActiveHeadingId(activeId);
    };

    const target: EventTarget = scrollContainer ?? window;
    target.addEventListener('scroll', findActive, { passive: true });
    findActive();

    return () => {
      target.removeEventListener('scroll', findActive);
    };
  }, [anchors, scrollContainer, threshold]);

  return activeHeadingId;
}
