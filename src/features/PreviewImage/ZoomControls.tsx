import { ZoomIn, ZoomOut, Maximize } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ZoomControlsProps {
  scale: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  canReset: boolean;
}

export function ZoomControls({
  scale,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  canReset,
}: ZoomControlsProps) {
  return (
    <div
      className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 bg-background/80 backdrop-blur-sm p-1.5 rounded-md border border-border shadow-sm"
      onPointerDown={(e) => e.stopPropagation()} // Stop drag when clicking controls
    >
      <Button
        variant="ghost"
        size="icon"
        onClick={onZoomOut}
        disabled={scale <= 0.1}
        title="Zoom Out"
        className="w-8 h-8 rounded-sm hover:bg-muted"
      >
        <ZoomOut className="w-4 h-4" />
      </Button>
      <div className="w-12 text-center text-sm font-medium tabular-nums text-foreground">
        {Math.round(scale * 100)}%
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={onZoomIn}
        disabled={scale >= 10}
        title="Zoom In"
        className="w-8 h-8 rounded-sm hover:bg-muted"
      >
        <ZoomIn className="w-4 h-4" />
      </Button>
      <div className="w-px h-4 bg-border mx-1" />
      <Button
        variant="ghost"
        size="icon"
        onClick={onResetZoom}
        disabled={!canReset}
        title="Reset Zoom"
        className="w-8 h-8 rounded-sm hover:bg-muted"
      >
        <Maximize className="w-4 h-4" />
      </Button>
    </div>
  );
}
