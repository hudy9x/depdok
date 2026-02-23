import { useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface CustomScrollerProps {
  orientation?: 'horizontal' | 'vertical';
  className?: string;
  style?: React.CSSProperties;
  contentClassName?: string;
  children: React.ReactNode;
}

/**
 * CustomScroller
 *
 * Layout — both children are absolute and fill the parent (inset-0).
 * Size the parent to control the scroller's dimensions.
 *
 *   parent  → position: relative; overflow: hidden
 *   ├── content child  → absolute inset-0; native scrollbar hidden
 *   └── scrollbar child → absolute inset-0; pointer-events: none
 *                          └── track + thumb (pointer-events re-enabled)
 *
 * Sync is DOM-only (no React state) — zero re-render overhead.
 * Horizontal mode also captures mouse-wheel / trackpad vertical delta
 * and converts it to horizontal scrolling.
 */
export function CustomScroller({
  orientation = 'horizontal',
  className,
  style,
  contentClassName,
  children,
}: CustomScrollerProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  const isDragging = useRef(false);
  const dragStartPos = useRef(0);
  const dragStartScroll = useRef(0);

  const isHorizontal = orientation === 'horizontal';

  // ── Sync: content scroll → thumb position / size ──────────────────────
  const updateThumb = useCallback(() => {
    const content = contentRef.current;
    const thumb = thumbRef.current;
    const track = trackRef.current;
    if (!content || !thumb || !track) return;

    if (isHorizontal) {
      const scrollable = content.scrollWidth - content.clientWidth;
      const hasScroll = scrollable > 0;
      thumb.style.opacity = hasScroll ? '' : '0';
      if (!hasScroll) return;

      const trackW = track.clientWidth;
      const thumbW = Math.max(24, (content.clientWidth / content.scrollWidth) * trackW);
      const thumbLeft = (content.scrollLeft / scrollable) * (trackW - thumbW);
      thumb.style.width = `${thumbW}px`;
      thumb.style.left = `${thumbLeft}px`;
    } else {
      const scrollable = content.scrollHeight - content.clientHeight;
      const hasScroll = scrollable > 0;
      thumb.style.opacity = hasScroll ? '' : '0';
      if (!hasScroll) return;

      const trackH = track.clientHeight;
      const thumbH = Math.max(24, (content.clientHeight / content.scrollHeight) * trackH);
      const thumbTop = (content.scrollTop / scrollable) * (trackH - thumbH);
      thumb.style.height = `${thumbH}px`;
      thumb.style.top = `${thumbTop}px`;
    }
  }, [isHorizontal]);

  useEffect(() => {
    const content = contentRef.current;
    if (!content) return;

    content.addEventListener('scroll', updateThumb, { passive: true });
    updateThumb();

    // Re-calculate when the content or its children resize
    const ro = new ResizeObserver(updateThumb);
    ro.observe(content);
    if (content.firstElementChild) ro.observe(content.firstElementChild);

    return () => {
      content.removeEventListener('scroll', updateThumb);
      ro.disconnect();
    };
  }, [updateThumb]);

  // ── Wheel → horizontal scroll (horizontal orientation only) ───────────
  useEffect(() => {
    if (!isHorizontal) return;
    const content = contentRef.current;
    if (!content) return;

    const onWheel = (e: WheelEvent) => {
      // Use deltaX if the user is already scrolling horizontally (trackpad),
      // otherwise convert deltaY (mouse wheel) to horizontal scroll.
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (delta === 0) return;
      e.preventDefault();
      content.scrollLeft += delta;
    };

    // passive: false so we can call preventDefault()
    content.addEventListener('wheel', onWheel, { passive: false });
    return () => content.removeEventListener('wheel', onWheel);
  }, [isHorizontal]);

  // ── Sync: thumb drag → content scroll ─────────────────────────────────
  const handleThumbMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      isDragging.current = true;
      dragStartPos.current = isHorizontal ? e.clientX : e.clientY;
      dragStartScroll.current = isHorizontal
        ? (contentRef.current?.scrollLeft ?? 0)
        : (contentRef.current?.scrollTop ?? 0);

      const handleMouseMove = (ev: MouseEvent) => {
        if (!isDragging.current) return;
        const content = contentRef.current;
        const track = trackRef.current;
        const thumb = thumbRef.current;
        if (!content || !track || !thumb) return;

        if (isHorizontal) {
          const delta = ev.clientX - dragStartPos.current;
          const ratio =
            (content.scrollWidth - content.clientWidth) /
            Math.max(1, track.clientWidth - thumb.clientWidth);
          content.scrollLeft = dragStartScroll.current + delta * ratio;
        } else {
          const delta = ev.clientY - dragStartPos.current;
          const ratio =
            (content.scrollHeight - content.clientHeight) /
            Math.max(1, track.clientHeight - thumb.clientHeight);
          content.scrollTop = dragStartScroll.current + delta * ratio;
        }
      };

      const handleMouseUp = () => {
        isDragging.current = false;
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [isHorizontal],
  );

  // ── Click on track (outside thumb) → jump scroll ──────────────────────
  const handleTrackClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const track = trackRef.current;
      const thumb = thumbRef.current;
      const content = contentRef.current;
      if (!track || !thumb || !content) return;
      if (e.target === thumb) return; // handled by thumb's own mousedown

      const rect = track.getBoundingClientRect();
      if (isHorizontal) {
        const clickX = e.clientX - rect.left;
        const thumbW = thumb.clientWidth;
        const ratio =
          (content.scrollWidth - content.clientWidth) /
          Math.max(1, track.clientWidth - thumbW);
        content.scrollLeft = (clickX - thumbW / 2) * ratio;
      } else {
        const clickY = e.clientY - rect.top;
        const thumbH = thumb.clientHeight;
        const ratio =
          (content.scrollHeight - content.clientHeight) /
          Math.max(1, track.clientHeight - thumbH);
        content.scrollTop = (clickY - thumbH / 2) * ratio;
      }
    },
    [isHorizontal],
  );

  return (
    <div className={cn('group/scroller relative overflow-hidden', className)} style={style}>
      {/* ── Content child ─────────────────────────────────────────────── */}
      <div
        ref={contentRef}
        data-custom-scroller-content
        className={cn(
          'absolute inset-0',
          isHorizontal
            ? 'overflow-x-scroll overflow-y-hidden'
            : 'overflow-y-scroll overflow-x-hidden',
          // Hide native scrollbar cross-browser
          '[&::-webkit-scrollbar]:hidden [scrollbar-width:none]',
          contentClassName,
        )}
      >
        {children}
      </div>

      {/* ── Scrollbar child ───────────────────────────────────────────── */}
      <div
        className={cn(
          'absolute inset-0 pointer-events-none',
          isHorizontal ? 'flex items-end' : 'flex justify-end',
        )}
      >
        {/* Track — thin strip at bottom (horizontal) or right (vertical) */}
        <div
          ref={trackRef}
          onClick={handleTrackClick}
          className={cn(
            'relative pointer-events-auto',
            isHorizontal ? 'w-full h-[4px]' : 'h-full w-[4px]',
          )}
        >
          {/* Thumb */}
          <div
            ref={thumbRef}
            onMouseDown={handleThumbMouseDown}
            className={cn(
              'absolute rounded-full',
              'opacity-0 group-hover/scroller:opacity-100',
              'transition-opacity duration-150',
              'bg-muted-foreground/30 hover:bg-muted-foreground/60',
              'cursor-pointer',
              isHorizontal ? 'h-full top-0' : 'w-full left-0',
            )}
          />
        </div>
      </div>
    </div>
  );
}
