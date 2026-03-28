import { useEffect } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { toJpeg } from 'html-to-image';
import { activeTabIdAtom } from '@/stores/TabStore';
import { setTabPreviewAtom } from '@/stores/TabPreviewStore';

export function useTabPreviewCapture(containerRef: React.RefObject<HTMLDivElement | null>) {
  const activeTabId = useAtomValue(activeTabIdAtom);
  const setTabPreview = useSetAtom(setTabPreviewAtom);

  useEffect(() => {
    if (!activeTabId || !containerRef.current) return;

    const capture = async () => {
      if (!containerRef.current) return;
      try {
        // html-to-image can lag on large DOMs. The two biggest causes of lag are:
        // 1. Parsing and embedding all web fonts (takes hundreds of ms).
        // 2. High resolution canvas drawing.
        // We skip fonts and lower the quality to make it blazing fast.
        const dataUrl = await toJpeg(containerRef.current, {
          quality: 0.8, // Low quality is fine for a preview card
          pixelRatio: 0.3, // Propotionally scales down instead of squishing
          skipFonts: true, // DRAMATICALLY improves performance by skipping font parsing
          fontEmbedCSS: '', // Fallback for older html-to-image versions
          style: { margin: '0' }
        });

        // Cache the preview image in jotai
        setTabPreview({ tabId: activeTabId, dataUrl });
      } catch (e) {
        console.error('Failed to capture tab preview', e);
      }
    };

    // Capture shortly after mount to allow editor to render
    const initialTimer = setTimeout(capture, 300);

    // Increase interval to 15 seconds so we aren't constantly blocking the main thread
    const intervalTimer = setInterval(capture, 15000);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(intervalTimer);
    };
  }, [activeTabId, setTabPreview, containerRef]);
}
