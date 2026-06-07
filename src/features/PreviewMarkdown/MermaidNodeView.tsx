import { useEffect, useState } from "react";
import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { Check, Copy, Eye, Code2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "next-themes";
import mermaid from "mermaid";

// Initialize Mermaid with a default configuration
mermaid.initialize({
  startOnLoad: false,
  suppressErrorRendering: true,
});

export function MermaidNodeView({ node, editor, getPos }: NodeViewProps) {
  const { theme } = useTheme();
  const editable = editor.isEditable;
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  
  // Track ProseMirror editor focus inside this block (for controls hover visibility)
  const [isEditorFocused, setIsEditorFocused] = useState(false);
  // Track rendering mode (preview vs code)
  const [mode, setMode] = useState<"preview" | "code">("preview");

  const codeText = node.textContent;

  // 1. Monitor Selection/Focus of this node
  useEffect(() => {
    const checkFocus = () => {
      try {
        if (typeof getPos !== "function") return;
        const pos = getPos();
        if (typeof pos !== "number") return;
        const { from, to } = editor.state.selection;
        const inside = from >= pos && to <= pos + node.nodeSize;
        const hasFocus = editor.isFocused && inside;
        setIsEditorFocused(hasFocus);
      } catch (e) {
        setIsEditorFocused(false);
      }
    };

    checkFocus();
    editor.on("selectionUpdate", checkFocus);
    editor.on("focus", checkFocus);
    editor.on("blur", checkFocus);

    return () => {
      editor.off("selectionUpdate", checkFocus);
      editor.off("focus", checkFocus);
      editor.off("blur", checkFocus);
    };
  }, [editor, getPos, node.nodeSize]);

  // 2. Configure Mermaid theme when active theme changes
  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: theme === "dark" ? "dark" : "default",
      themeVariables: theme === "dark" 
        ? {
            background: "#18181b",
            primaryColor: "#27272a",
            nodeBorder: "#3f3f46",
            lineColor: "#71717a",
          }
        : {
            background: "#f4f4f5",
            primaryColor: "#e4e4e7",
            nodeBorder: "#d4d4d8",
            lineColor: "#a1a1aa",
          }
    });
  }, [theme]);

  // 3. Render Mermaid text to SVG (debounced)
  useEffect(() => {
    let isMounted = true;
    
    const renderDiagram = async () => {
      if (!codeText.trim()) {
        setSvg("");
        setError(null);
        return;
      }

      try {
        setError(null);
        // Generate a valid element id
        const cleanId = `mermaid-${node.attrs.id || Math.random().toString(36).slice(2, 9)}`;
        
        // Render raw string to SVG
        const { svg: renderedSvg } = await mermaid.render(cleanId, codeText);
        
        if (isMounted) {
          setSvg(renderedSvg);
        }
      } catch (err) {
        console.error("Mermaid render error:", err);
        if (isMounted) {
          setError(err instanceof Error ? err.message : String(err));
        }
      }
    };

    const timer = setTimeout(renderDiagram, 150);
    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [codeText, node.attrs.id]);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(codeText);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy code: ", err);
    }
  };


  return (
    <NodeViewWrapper className="mermaid-node-wrapper relative group my-4 transition-all duration-200">
      {/* Absolute controls (shown if editable) */}
      {editable && (
        <div className={`absolute top-0 right-2 flex items-center gap-1.5 transition-opacity duration-200 z-20 select-none ${
          isEditorFocused ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        }`}>
          {/* Copy code button */}
          <Button
            variant="outline"
            size="icon"
            className="h-7   w-7 text-muted-foreground hover:text-foreground bg-background/80"
            onClick={copyToClipboard}
            title="Copy diagram source"
          >
            {isCopied ? <Check className="!h-3.5 !w-3.5 text-green-500" /> : <Copy className="!h-3.5 !w-3.5" />}
          </Button>

          {/* Mode switch tabs */}
          <div className="flex bg-background/85 rounded-md p-0.5 border border-border">
            <Button
              variant={mode === "preview" ? "secondary" : "ghost"}
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
              onClick={() => setMode("preview")}
              title="Preview diagram"
            >
              <Eye className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant={mode === "code" ? "secondary" : "ghost"}
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
              onClick={() => {
                setMode("code");
                if (typeof getPos === "function") {
                  const pos = getPos();
                  if (typeof pos === "number") {
                    editor.commands.setTextSelection(pos + 1);
                    editor.commands.focus();
                  }
                }
              }}
              title="Edit code"
            >
              <Code2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Editor / Render Body */}
      <div className="relative w-full">
        {/* CODE MODE */}
        <div className={mode === "code" ? "block" : "hidden"}>
          <pre className="relative p-4 font-mono text-sm leading-relaxed overflow-x-auto bg-zinc-950 text-zinc-50 border border-border m-0 rounded-lg">
            <NodeViewContent className="outline-none text-foreground" />
          </pre>
        </div>

        {/* PREVIEW MODE */}
        <div 
          className={`p-6 flex flex-col items-center justify-center min-h-[100px] transition-colors duration-200 ${
            mode === "preview" ? "block" : "hidden"
          }`}
        >
          {error ? (
            <div className="w-full max-w-lg bg-destructive/10 border border-destructive/20 rounded-md p-4 text-destructive flex items-start gap-2.5">
              <AlertCircle className="h-4.5 w-4.5 shrink-0 mt-0.5" />
              <div className="flex-1 text-xs">
                <span className="font-semibold block mb-1">Diagram Render Error</span>
                <pre className="font-mono whitespace-pre-wrap leading-tight text-[11px] opacity-90 m-0">
                  {error}
                </pre>
              </div>
            </div>
          ) : svg ? (
            <div 
              className="mermaid-render-container w-full overflow-x-auto flex justify-center py-2"
              dangerouslySetInnerHTML={{ __html: svg }}
            />
          ) : (
            <div className="text-xs text-muted-foreground italic font-mono">
              Empty diagram...
            </div>
          )}
        </div>
      </div>
    </NodeViewWrapper>
  );
}
