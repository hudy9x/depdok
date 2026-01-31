import { ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ZoomControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  zoom: number;
}

export function ZoomControls({ onZoomIn, onZoomOut, onReset, zoom }: ZoomControlsProps) {
  return (
    <div className="absolute bottom-4 right-4 flex flex-col items-center gap-2 z-20">
      <Button
        variant="outline"
        size="icon"
        onClick={onZoomIn}
        title="Zoom In"
      >
        <ZoomIn className="h-4 w-4" />
      </Button>
      <Button
        variant="outline"
        size="icon"
        onClick={onZoomOut}
        title="Zoom Out"
      >
        <ZoomOut className="h-4 w-4" />
      </Button>
      <Button
        variant="outline"
        size="icon"
        onClick={onReset}
        title="Reset Zoom"
      >
        <RotateCcw className="h-4 w-4" />
      </Button>
      <div className="text-[10px] border-border font-medium w-10 py-1 rounded-md bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border flex items-center justify-center">
        {zoom}%
      </div>
    </div>
  );
}
