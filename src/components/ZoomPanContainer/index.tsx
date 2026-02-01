import { useRef, useState, useCallback, useEffect, ReactNode } from 'react';
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { ZoomConfig, defaultZoomConfig } from './zoomConfig';
import { Button } from "@/components/ui/button";

interface ZoomPanContainerProps {
  children: ReactNode;
  config?: Partial<ZoomConfig>;
  className?: string;
}

// Store zoom/pan state outside component to persist across remounts
const zoomPanState = {
  zoom: 1,
  pan: { x: 0, y: 0 }
};

export function ZoomPanContainer({
  children,
  config: userConfig,
  className = ''
}: ZoomPanContainerProps) {
  const config = { ...defaultZoomConfig, ...userConfig };

  const containerRef = useRef<SVGSVGElement>(null);
  // const contentRef = useRef<HTMLDivElement>(null); // Unused in SVG implementation

  // Initialize from persisted state, or use config default
  const [zoom, setZoom] = useState(() => zoomPanState.zoom || config.initialZoom);
  const [pan, setPan] = useState(() => zoomPanState.pan || { x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Persist zoom state whenever it changes
  useEffect(() => {
    zoomPanState.zoom = zoom;
  }, [zoom]);

  // Persist pan state whenever it changes
  useEffect(() => {
    zoomPanState.pan = pan;
  }, [pan]);

  // Center content on load if configured
  useEffect(() => {
    if (config.centerOnLoad && containerRef.current) {
      // use setTimeout to ensure the DOM is fully rendered
      setTimeout(() => {
        const svg = containerRef.current;
        if (!svg) return;

        const g = svg.querySelector('g');
        if (!g) return;

        try {
          const bbox = g.getBBox();
          const containerRect = svg.getBoundingClientRect();

          if (bbox.width === 0 || bbox.height === 0) return;

          const scale = config.initialZoom;
          // Calculate centered position
          // center of container - center of content (scaled)
          const x = (containerRect.width - bbox.width * scale) / 2 - bbox.x * scale;
          const y = (containerRect.height - bbox.height * scale) / 2 - bbox.y * scale;

          setPan({ x, y });
          setZoom(scale);
        } catch (e) {
          console.error("Failed to center SVG content:", e);
        }
      }, 50);
    }
  }, [config.centerOnLoad, config.initialZoom, children]); // Re-run when children change

  // Clamp zoom value within min/max bounds
  const clampZoom = useCallback((value: number) => {
    return Math.min(Math.max(value, config.minZoom), config.maxZoom);
  }, [config.minZoom, config.maxZoom]);

  // Handle mouse wheel zoom
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();

    const delta = -e.deltaY * config.wheelZoomSpeed;
    const newZoom = clampZoom(zoom + delta);

    if (newZoom !== zoom) {
      // Zoom towards mouse cursor position
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // Calculate the point under the mouse in content coordinates
        const contentX = (mouseX - pan.x) / zoom;
        const contentY = (mouseY - pan.y) / zoom;

        // Calculate new pan to keep the same point under the mouse
        const newPan = {
          x: mouseX - contentX * newZoom,
          y: mouseY - contentY * newZoom,
        };

        setPan(newPan);
      }

      setZoom(newZoom);
    }
  }, [zoom, pan, config.wheelZoomSpeed, clampZoom]);

  // Handle mouse down for panning
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Only start dragging on left mouse button
    if (e.button === 0) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      e.preventDefault();
    }
  }, [pan]);

  // Handle mouse move for panning
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isDragging) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  }, [isDragging, dragStart]);

  // Handle mouse up to stop panning
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Programmatic zoom controls
  const zoomIn = useCallback(() => {
    setZoom(prev => clampZoom(prev + config.zoomStep));
  }, [config.zoomStep, clampZoom]);

  const zoomOut = useCallback(() => {
    setZoom(prev => clampZoom(prev - config.zoomStep));
  }, [config.zoomStep, clampZoom]);

  const resetZoom = useCallback(() => {
    setZoom(config.initialZoom);
    setPan({ x: 0, y: 0 });
  }, [config.initialZoom]);

  // Attach wheel event listener
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, [handleWheel]);

  // Attach mouse move and up listeners when dragging
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);

      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  return (
    <div className={`relative overflow-hidden ${className}`} style={{ width: '100%', height: '100%' }}>
      <svg
        ref={containerRef as any}
        onMouseDown={handleMouseDown}
        style={{ cursor: isDragging ? 'grabbing' : 'grab', width: '100%', height: '100%', display: 'block' }}
      >
        <g
          transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}
          style={{ transition: isDragging ? 'none' : 'transform 0.1s ease-out' }}
        >
          {children}
        </g>
      </svg>

      {/* Zoom controls overlay */}
      <div className="absolute bottom-4 right-4 flex flex-col items-center gap-2 z-20">
        <Button
          variant="outline"
          size="icon"
          onClick={zoomIn}

          title="Zoom In"
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={zoomOut}

          title="Zoom Out"
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={resetZoom}

          title="Reset Zoom"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
        <div className="text-[10px] border-border font-medium w-10 py-1 rounded-md bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border flex items-center justify-center">
          {Math.round(zoom * 100)}%
        </div>
      </div>
    </div>
  );
}