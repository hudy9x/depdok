import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { renderMermaid } from "beautiful-mermaid";
import { ZoomPanContainer } from "@/components/ZoomPanContainer";

interface MermaidPreviewProps {
  content: string;
}

export function MermaidPreview({ content }: MermaidPreviewProps) {
  const { theme } = useTheme();
  const [error, setError] = useState<string | null>(null);
  const [svg, setSvg] = useState<string>("");

  useEffect(() => {
    if (!content.trim()) {
      setSvg("");
      setError(null);
      return;
    }

    const renderDiagram = async () => {
      try {
        setError(null);

        // Configure colors based on theme
        const colors = theme === "dark"
          ? {
            bg: "#09090b",      // zinc-950
            fg: "#fafafa",      // zinc-50
            line: "#81819aff",    // zinc-600
            accent: "#ccf760ff",  // arrow
            muted: "#d8c2b2ff",   // message color
            surface: "#18181b", // zinc-900
            border: "#3f3f46",  // zinc-700
          }
          : {
            bg: "#ffffff",      // white
            fg: "#18181b",      // zinc-900
            line: "#a1a1aa",    // zinc-400
            accent: "#52525b",  // zinc-600
            muted: "#71717a",   // zinc-500
            surface: "#fafafa", // zinc-50
            border: "#d4d4d8",  // zinc-300
          };

        const renderedSvg = await renderMermaid(content, {
          ...colors,
          font: "system-ui, -apple-system, sans-serif",
          padding: 40,
          nodeSpacing: 24,
          layerSpacing: 40,
        });

        setSvg(renderedSvg);
      } catch (err) {
        console.error("Mermaid rendering error:", err);
        setError(err instanceof Error ? err.message : "Failed to render diagram");
        setSvg("");
      }
    };

    renderDiagram();
  }, [content, theme]);

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
      <ZoomPanContainer
        className="w-full h-full"
        config={{
          minZoom: 0.1,
          maxZoom: 10,
          initialZoom: 1
        }}
      >
        <g dangerouslySetInnerHTML={{ __html: svg }} />
      </ZoomPanContainer>
    </div>
  );
}
