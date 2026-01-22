import { useEffect, useState, useRef } from "react";
import { useTheme } from "next-themes";
import mermaid from "mermaid";
import svgPanZoom from "svg-pan-zoom";
import { ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MermaidPreviewProps {
  content: string;
}

export function MermaidPreview({ content }: MermaidPreviewProps) {
  const { theme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const panZoomInstance = useRef<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [svg, setSvg] = useState<string>("");
  const [zoom, setZoom] = useState<number>(100);

  useEffect(() => {
    // Initialize Mermaid with theme
    mermaid.initialize({
      startOnLoad: false,
      theme: theme === "dark" ? "dark" : "default",
      securityLevel: "loose",
      fontFamily: "system-ui, -apple-system, sans-serif",
    });
  }, [theme]);

  useEffect(() => {
    if (!content.trim()) {
      setSvg("");
      setError(null);
      return;
    }

    const renderDiagram = async () => {
      try {
        setError(null);
        const { svg: renderedSvg } = await mermaid.render(
          `mermaid-${Date.now()}`,
          content
        );
        setSvg(renderedSvg);
      } catch (err) {
        console.error("Mermaid rendering error:", err);
        setError(err instanceof Error ? err.message : "Failed to render diagram");
        setSvg("");
      }
    };

    renderDiagram();
  }, [content, theme]);

  // Initialize svg-pan-zoom after SVG is rendered
  useEffect(() => {
    if (!svg || !containerRef.current) return;

    // Cleanup previous instance
    if (panZoomInstance.current) {
      panZoomInstance.current.destroy();
      panZoomInstance.current = null;
    }

    // Wait for DOM to update
    setTimeout(() => {
      const svgElement = containerRef.current?.querySelector('svg');
      if (svgElement) {
        // Set SVG to fill container
        svgElement.style.width = '100%';
        svgElement.style.height = '100%';

        panZoomInstance.current = svgPanZoom(svgElement, {
          zoomEnabled: true,
          controlIconsEnabled: false,  // Disable built-in controls
          fit: true,
          center: true,
          minZoom: 0.5,
          maxZoom: 10,
          zoomScaleSensitivity: 0.3,
          onZoom: (scale: number) => {
            setZoom(Math.round(scale * 100));
          },
        });

        // Set initial zoom percentage
        setZoom(Math.round(panZoomInstance.current.getZoom() * 100));

        // Handle container resize
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
      if (panZoomInstance.current) {
        // Cleanup resize observer
        if ((panZoomInstance.current as any).resizeObserver) {
          (panZoomInstance.current as any).resizeObserver.disconnect();
        }
        panZoomInstance.current.destroy();
        panZoomInstance.current = null;
      }
    };
  }, [svg]);

  const handleZoomIn = () => {
    if (panZoomInstance.current) {
      panZoomInstance.current.zoomIn();
    }
  };

  const handleZoomOut = () => {
    if (panZoomInstance.current) {
      panZoomInstance.current.zoomOut();
    }
  };

  const handleReset = () => {
    if (panZoomInstance.current) {
      panZoomInstance.current.reset();
      panZoomInstance.current.fit();
      panZoomInstance.current.center();
    }
  };

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center p-8">
        <div className="max-w-2xl w-full">
          <div className="bg-destructive/10 border border-destructive/50 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-destructive mb-2">
              Diagram Syntax Error
            </h3>
            <pre className="text-sm text-destructive/90 whitespace-pre-wrap font-mono">
              {error}
            </pre>
          </div>
        </div>
      </div>
    );
  }

  if (!svg) {
    return (
      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
        No diagram to display
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      <div
        ref={containerRef}
        className="w-full h-full bg-background flex items-center justify-center"
        dangerouslySetInnerHTML={{ __html: svg }}
      />

      {/* Custom zoom controls */}
      <div className="absolute bottom-4 right-4 flex flex-col items-center gap-2 z-20">
        <Button
          variant="outline"
          size="icon"
          onClick={handleZoomIn}
          title="Zoom In"
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={handleZoomOut}
          title="Zoom Out"
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={handleReset}
          title="Reset Zoom"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
        <div className="text-[10px] border-border font-medium w-10 py-1 rounded-md bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border flex items-center justify-center">
          {zoom}%
        </div>
      </div>
    </div>
  );
}
