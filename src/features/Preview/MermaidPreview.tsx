import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import mermaid from "mermaid";
import { ZoomPanContainer } from "@/components/ZoomPanContainer";

interface MermaidPreviewProps {
  content: string;
}

export function MermaidPreview({ content }: MermaidPreviewProps) {
  const { theme } = useTheme();
  const [error, setError] = useState<string | null>(null);
  const [svg, setSvg] = useState<string>("");

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
