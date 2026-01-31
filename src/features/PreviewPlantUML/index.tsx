import { useState, useEffect } from "react";
import { encode } from "plantuml-encoder";
import { toast } from "sonner";
import { useDebounce } from "use-debounce";
import { useTheme } from "next-themes";
import { useAtomValue } from "jotai";
import { useSvgPanZoom, ZoomControls } from "@/components/SvgZoom";
import { plantUmlServerUrlAtom } from "@/stores/SettingsStore";

interface PlantUMLPreviewProps {
  content: string;
}

export function PlantUMLPreview({ content }: PlantUMLPreviewProps) {
  const [svgContent, setSvgContent] = useState("");
  const { theme } = useTheme();
  const [loading, setLoading] = useState(false);
  const [debouncedContent] = useDebounce(content, 800);
  const plantUmlServerUrl = useAtomValue(plantUmlServerUrlAtom);

  const { containerRef, zoom, zoomIn, zoomOut, reset } = useSvgPanZoom({
    content: svgContent,
    minZoom: 0.05,
    initialZoom: 0.7
  });

  useEffect(() => {
    if (!debouncedContent) {
      setSvgContent("");
      return;
    }

    const fetchDiagram = async () => {
      setLoading(true);
      try {
        const encoded = encode(debouncedContent);

        // Use custom server URL if provided, otherwise use default
        let url: string;
        if (plantUmlServerUrl) {
          // Custom server: don't use dark mode parameter (may not be supported)
          url = `${plantUmlServerUrl}/svg/${encoded}`;
        } else {
          // Default server: use dark mode parameter
          url = `https://img.plantuml.biz/plantuml/${theme === 'dark' ? 'd' : ''}svg/${encoded}`;
        }

        const res = await fetch(url);
        if (!res.ok) {
          throw new Error(`Server returned ${res.status}: ${res.statusText}`);
        }

        const svg = await res.text();
        setSvgContent(svg);
      } catch (error) {
        console.error("Error fetching SVG from PlantUML server:", error);
        toast.error("Failed to generate UML diagram.");
      } finally {
        setLoading(false);
      }
    };

    fetchDiagram();
  }, [debouncedContent, theme, plantUmlServerUrl]);



  return (
    <div className="w-full h-full bg-background relative overflow-hidden">
      {loading && (
        <div className="absolute top-2 right-2 text-xs text-muted-foreground bg-background/80 px-2 py-1 rounded z-50">
          Rendering...
        </div>
      )}
      <div
        ref={containerRef}
        className="w-full h-full flex items-center justify-center p-0 bg-background"
        dangerouslySetInnerHTML={{ __html: svgContent }}
      />

      {/* Zoom controls */}
      <ZoomControls
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onReset={reset}
        zoom={zoom}
      />
    </div>
  );
}
