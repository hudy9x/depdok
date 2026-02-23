import { useState, useMemo, useRef, useEffect } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { ZoomControls } from './ZoomControls';

interface PreviewImageProps {
  filePath: string;
}

export function PreviewImage({ filePath }: PreviewImageProps) {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });

  // Use refs in wheel event to avoid stale state in closure
  const stateRef = useRef({ scale, position });
  useEffect(() => {
    stateRef.current = { scale, position };
  }, [scale, position]);

  const resolvedSrc = useMemo(() => {
    if (!filePath) return '';
    try {
      return convertFileSrc(filePath);
    } catch (error) {
      console.error('[PreviewImage] Failed to convert file path:', filePath, error);
      return '';
    }
  }, [filePath]);

  const handleZoomIn = () => setScale((prev) => Math.min(prev + 0.25, 5));
  const handleZoomOut = () => setScale((prev) => Math.max(prev - 0.25, 0.1));
  const handleResetZoom = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault(); // Stop page scrolling

      const { scale, position } = stateRef.current;

      // Handle pinch (ctrlKey is true on trackpad pinch in some browsers) or normal scroll wheel
      const sensitivity = e.ctrlKey ? 0.015 : 0.0015;
      const zoomFactor = -e.deltaY * sensitivity;

      const newScale = Math.min(Math.max(scale * (1 + zoomFactor), 0.1), 10);

      // Calculate cursor position relative to container
      const rect = container.getBoundingClientRect();
      const cursorX = e.clientX - rect.left - rect.width / 2;
      const cursorY = e.clientY - rect.top - rect.height / 2;

      // Adjust position so we zoom towards the cursor
      // (cursorX - position.x) is the distance from the image center to the cursor
      const scaleRatio = newScale / scale;
      const newPosX = cursorX - (cursorX - position.x) * scaleRatio;
      const newPosY = cursorY - (cursorY - position.y) * scaleRatio;

      setScale(newScale);
      setPosition({ x: newPosX, y: newPosY });
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, []);

  const handlePointerDown = (e: React.PointerEvent) => {
    // Only left click or middle click for panning
    if (e.button !== 0 && e.button !== 1) return;
    isDragging.current = true;
    dragStart.current = { x: e.clientX - position.x, y: e.clientY - position.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current) return;
    setPosition({
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y,
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    isDragging.current = false;
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  if (!resolvedSrc) {
    return (
      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
        Loading image...
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full flex items-center justify-center overflow-hidden bg-background/50 cursor-grab active:cursor-grabbing touch-none select-none"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {/* Zoom Controls */}
      <ZoomControls
        scale={scale}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onResetZoom={handleResetZoom}
        canReset={!(scale === 1 && position.x === 0 && position.y === 0)}
      />

      {/* Image Container */}
      <div
        className="origin-center will-change-transform"
        style={{ transform: `translate(${position.x}px, ${position.y}px) scale(${scale})` }}
      >
        <img
          src={resolvedSrc}
          alt={filePath.split(/[/\\]/).pop()}
          className="max-w-full max-h-[90vh] object-contain shadow-lg pointer-events-none"
          draggable={false}
        />
      </div>
    </div>
  );
}
