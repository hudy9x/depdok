import { useState, useEffect } from "react";
import { encode } from "plantuml-encoder";
import { toast } from "sonner";
import { useDebounce } from "use-debounce";
import { useTheme } from "next-themes";
import { useAtomValue } from "jotai";
import { ZoomPanContainer } from "@/components/ZoomPanContainer";
import { plantUmlServerUrlAtom } from "@/stores/SettingsStore";

interface PlantUMLPreviewProps {
  content: string;
}

export function PlantUMLPreview({ content }: PlantUMLPreviewProps) {
  const [svgContent, setSvgContent] = useState("");
  const { resolvedTheme } = useTheme();
  const [loading, setLoading] = useState(false);
  const [debouncedContent] = useDebounce(content, 800);
  const plantUmlServerUrl = useAtomValue(plantUmlServerUrlAtom);

  // No longer using useSvgPanZoom hook

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
          // Use resolvedTheme to handle 'system' preference correctly
          const isDark = resolvedTheme === 'dark';
          url = `https://img.plantuml.biz/plantuml/${isDark ? 'd' : ''}svg/${encoded}`;
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
  }, [debouncedContent, resolvedTheme, plantUmlServerUrl]);



  return (
    <div className="w-full h-full bg-background relative overflow-hidden">
      {loading && (
        <div className="absolute top-2 right-2 text-xs text-muted-foreground bg-background/80 px-2 py-1 rounded z-50">
          Rendering...
        </div>
      )}

      <ZoomPanContainer
        className="w-full h-full"
        config={{
          minZoom: 0.1,
          maxZoom: 5,
          initialZoom: 0.8,
          centerOnLoad: true
        }}
      >
        <g
          dangerouslySetInnerHTML={{ __html: svgContent }}
        />
      </ZoomPanContainer>
    </div>
  );
}
