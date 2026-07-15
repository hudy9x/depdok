import { useEffect, useState } from "react";
import { useDebounce } from "use-debounce";
import { useTheme } from "next-themes";
import { ZoomPanContainer } from "@/components/ZoomPanContainer";
import { Loader2 } from "lucide-react";
import { queuePlantUMLRender } from "./plantuml-queue";

interface PlantUMLNativePreviewProps {
  content: string;
  onContentChange?: (content: string) => void;
}

export function PlantUMLNativePreview({ content }: PlantUMLNativePreviewProps) {
  const { resolvedTheme } = useTheme();
  const [svgContent, setSvgContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debouncedContent] = useDebounce(content, 600);

  useEffect(() => {
    if (!debouncedContent.trim()) {
      setSvgContent("");
      setError(null);
      return;
    }

    let isMounted = true;
    const renderDiagram = async () => {
      setLoading(true);
      setError(null);
      try {
        const svg = await queuePlantUMLRender(debouncedContent, resolvedTheme === "dark");
        if (isMounted) {
          setSvgContent(svg);
        }
      } catch (err: any) {
        console.error("Error rendering PlantUML natively:", err);
        if (isMounted) {
          setError(err.message || String(err));
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    renderDiagram();

    return () => {
      isMounted = false;
    };
  }, [debouncedContent, resolvedTheme]);

  return (
    <div className="w-full h-full relative overflow-hidden bg-layout-content">
      {loading && (
        <div className="absolute top-2 right-2 flex items-center gap-1.5 text-xs text-muted-foreground bg-background/80 px-2 py-1 rounded border border-border z-50 animate-in fade-in duration-200">
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>Rendering...</span>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex items-center justify-center p-4 bg-background/90 z-40 overflow-auto">
          <div className="max-w-md w-full p-4 rounded-md border border-destructive/20 bg-destructive/10 text-destructive text-sm font-mono whitespace-pre-wrap">
            <h4 className="font-semibold mb-1 text-destructive-foreground">PlantUML Render Error</h4>
            {error}
          </div>
        </div>
      )}

      <ZoomPanContainer
        config={{ minZoom: 0.1, maxZoom: 5, initialZoom: 0.8, centerOnLoad: true }}
      >
        <g dangerouslySetInnerHTML={{ __html: svgContent }} />
      </ZoomPanContainer>
    </div>
  );
}
