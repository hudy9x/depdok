import { useState, useEffect, useRef } from "react";
import svgPanZoom from "svg-pan-zoom";

interface UseSvgPanZoomProps {
  content?: string; // The SVG content or key to trigger initialization
  minZoom?: number;
  maxZoom?: number;
  zoomScaleSensitivity?: number;
  initialZoom?: number;
}

export function useSvgPanZoom({
  content,
  minZoom = 0.5,
  maxZoom = 10,
  zoomScaleSensitivity = 0.3,
  initialZoom,
}: UseSvgPanZoomProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const panZoomInstance = useRef<SvgPanZoom.Instance | null>(null);
  const [zoom, setZoom] = useState<number>(100);

  const cachedZoomRef = useRef<number | null>(null);
  const cachedPanRef = useRef<{ x: number; y: number } | null>(null);
  const cachedInitialZoomRef = useRef<boolean>(false);

  const createPanZoom = ({
    content,
    minZoom,
    maxZoom,
    zoomScaleSensitivity,
    initialZoom
  }: UseSvgPanZoomProps, isContentUpdated: boolean = false) => {

    if (!content || !containerRef.current) return;

    // Use a small timeout to ensure the DOM is updated with the SVG content
    const timeoutId = setTimeout(() => {
      const svgElement = containerRef.current?.querySelector("svg");
      if (svgElement) {
        svgElement.style.width = "100%";
        svgElement.style.height = "100%";

        if (!cachedInitialZoomRef.current || isContentUpdated) {
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
              cachedZoomRef.current = scale;
              console.log('cachedZoomRef', cachedZoomRef.current)
            },
            onPan: (pan: { x: number; y: number }) => {
              cachedPanRef.current = pan;
              console.log('cachedPanRef', cachedPanRef.current)
            }
          });

        }

        const _panZoomInstance = panZoomInstance.current;

        if (!_panZoomInstance) return;

        console.log('cached Zoom', cachedZoomRef.current, _panZoomInstance.getZoom())
        console.log('cached Pan', cachedPanRef.current, _panZoomInstance.getPan())



        if (initialZoom && !cachedInitialZoomRef.current) {
          console.log('initial zoom')
          _panZoomInstance.zoom(initialZoom);
          _panZoomInstance.center(); // Re-center after zoom
          cachedInitialZoomRef.current = true;
        }

        if (cachedInitialZoomRef.current) {
          cachedZoomRef.current && _panZoomInstance.zoom(cachedZoomRef.current);
          cachedPanRef.current && _panZoomInstance.pan(cachedPanRef.current);
        }


        setZoom(Math.round(_panZoomInstance.getZoom() * 100));

        // Handle resizing
        const resizeObserver = new ResizeObserver(() => {
          console.log('handle resize')
          // if (panZoomInstance.current) {
          //   panZoomInstance.current.resize();
          //   // Only fit and center if no initial zoom was specified
          //   if (!initialZoom) {
          //     panZoomInstance.current.fit();
          //     panZoomInstance.current.center();
          //   }
          // }
        });

        if (containerRef.current) {
          resizeObserver.observe(containerRef.current);
        }

        // Store observer for cleanup
        (panZoomInstance.current as any).resizeObserver = resizeObserver;
      }
    }, 100);
  }

  useEffect(() => {
    createPanZoom({ content, minZoom, maxZoom, zoomScaleSensitivity, initialZoom }, true);
  }, [content]);



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
