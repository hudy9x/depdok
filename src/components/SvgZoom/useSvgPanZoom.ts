import { useState, useEffect, useRef } from "react";
import svgPanZoom from "svg-pan-zoom";

interface UseSvgPanZoomProps {
  content: string; // The SVG content or key to trigger initialization
  minZoom?: number;
  maxZoom?: number;
  zoomScaleSensitivity?: number;
}

export function useSvgPanZoom({
  content,
  minZoom = 0.5,
  maxZoom = 10,
  zoomScaleSensitivity = 0.3,
}: UseSvgPanZoomProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const panZoomInstance = useRef<SvgPanZoom.Instance | null>(null);
  const [zoom, setZoom] = useState<number>(100);

  useEffect(() => {
    if (!content || !containerRef.current) return;

    if (panZoomInstance.current) {
      panZoomInstance.current.destroy();
      panZoomInstance.current = null;
    }

    // Use a small timeout to ensure the DOM is updated with the SVG content
    const timeoutId = setTimeout(() => {
      const svgElement = containerRef.current?.querySelector("svg");
      if (svgElement) {
        svgElement.style.width = "100%";
        svgElement.style.height = "100%";

        panZoomInstance.current = svgPanZoom(svgElement, {
          zoomEnabled: true,
          controlIconsEnabled: false,
          fit: true,
          center: true,
          minZoom,
          maxZoom,
          zoomScaleSensitivity,
          onZoom: (scale: number) => {
            setZoom(Math.round(scale * 100));
          },
        });

        setZoom(Math.round(panZoomInstance.current.getZoom() * 100));

        // Handle resizing
        const resizeObserver = new ResizeObserver(() => {
          if (panZoomInstance.current) {
            panZoomInstance.current.resize();
            panZoomInstance.current.fit();
            panZoomInstance.current.center();
          }
        });

        if (containerRef.current) {
          resizeObserver.observe(containerRef.current);
        }

        // Store observer for cleanup
        (panZoomInstance.current as any).resizeObserver = resizeObserver;
      }
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      if (panZoomInstance.current) {
        const resizeObserver = (panZoomInstance.current as any).resizeObserver as ResizeObserver;
        if (resizeObserver) {
          resizeObserver.disconnect();
        }
        panZoomInstance.current.destroy();
        panZoomInstance.current = null;
      }
    };
  }, [content, minZoom, maxZoom, zoomScaleSensitivity]);

  const zoomIn = () => panZoomInstance.current?.zoomIn();
  const zoomOut = () => panZoomInstance.current?.zoomOut();
  const reset = () => {
    if (panZoomInstance.current) {
      panZoomInstance.current.reset();
      panZoomInstance.current.fit();
      panZoomInstance.current.center();
    }
  };

  return {
    containerRef,
    zoom,
    zoomIn,
    zoomOut,
    reset,
  };
}
