import { useState, useEffect } from "react";
import { encode } from "plantuml-encoder";
import { toast } from "sonner";
import { useDebounce } from "use-debounce";
import { useTheme } from "next-themes";

interface PlantUMLPreviewProps {
  content: string;
}

export function PlantUMLPreview({ content }: PlantUMLPreviewProps) {
  const [svgContent, setSvgContent] = useState("");
  const { theme } = useTheme();
  const [loading, setLoading] = useState(false);
  const [debouncedContent] = useDebounce(content, 800);

  useEffect(() => {
    if (!debouncedContent) {
      setSvgContent("");
      return;
    }

    const fetchDiagram = async () => {
      setLoading(true);
      try {
        const encoded = encode(debouncedContent);
        const url = `https://img.plantuml.biz/plantuml/${theme === 'dark' ? 'd' : ''}svg/${encoded}`;

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
  }, [debouncedContent, theme]);

  return (
    <div className="w-full h-full p-4 overflow-auto bg-background relative">
      {loading && (
        <div className="absolute top-2 right-2 text-xs text-muted-foreground bg-background/80 px-2 py-1 rounded">
          Rendering...
        </div>
      )}
      <div
        className="flex min-h-full items-center justify-center p-4"
        dangerouslySetInnerHTML={{ __html: svgContent }}
      />
    </div>
  );
}
