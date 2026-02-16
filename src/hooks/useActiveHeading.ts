import { useState, useEffect } from 'react';

/**
 * Custom hook to detect which heading is currently active (visible) in the viewport.
 * Uses IntersectionObserver to track heading visibility as the user scrolls.
 * 
 * @param headingIds Array of heading IDs to observe
 * @returns The ID of the currently active heading, or null if none are visible
 */
export function useActiveHeading(headingIds: string[]): string | null {
  const [activeHeadingId, setActiveHeadingId] = useState<string | null>(null);

  useEffect(() => {
    if (headingIds.length === 0) return;

    // Track which headings are currently intersecting
    const intersectingHeadings = new Map<string, IntersectionObserverEntry>();

    const observer = new IntersectionObserver(
      (entries) => {
        // Update the map of intersecting headings
        entries.forEach((entry) => {
          const id = entry.target.id;
          if (entry.isIntersecting) {
            intersectingHeadings.set(id, entry);
          } else {
            intersectingHeadings.delete(id);
          }
        });

        // Find the topmost intersecting heading
        if (intersectingHeadings.size > 0) {
          const topmost = Array.from(intersectingHeadings.values())
            .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];

          setActiveHeadingId(topmost.target.id);
        } else {
          setActiveHeadingId(null);
        }
      },
      {
        // Trigger when heading is in the top 30% of viewport
        rootMargin: '-20% 0px -70% 0px',
        threshold: 0,
      }
    );

    // Observe all heading elements
    headingIds.forEach((id) => {
      const element = document.getElementById(id);
      if (element) {
        observer.observe(element);
      }
    });

    // Cleanup
    return () => {
      observer.disconnect();
    };
  }, [headingIds]);

  return activeHeadingId;
}
