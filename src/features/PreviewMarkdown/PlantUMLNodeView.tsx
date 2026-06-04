import { useEffect, useState } from "react";
import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { Check, Copy, Eye, Code2, Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PlantUMLBrowserPreview } from "../PreviewPlantUML/PlantUMLBrowserPreview";

export function PlantUMLNodeView({ node, editor, getPos }: NodeViewProps) {
  const editable = editor.isEditable;
  const [isCopied, setIsCopied] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
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

  // 2. Escape key listener to exit fullscreen
  useEffect(() => {
    if (!isFullscreen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsFullscreen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen]);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(codeText);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy code: ", err);
    }
  };

  const handleContentChange = (newContent: string) => {
    if (typeof getPos !== "function") return;
    const pos = getPos();
    if (typeof pos !== "number") return;
    
    // Replace the code block content in ProseMirror
    editor.view.dispatch(
      editor.state.tr.insertText(newContent, pos + 1, pos + node.nodeSize - 1)
    );
  };

  return (
    <NodeViewWrapper className={`plantuml-node-wrapper relative group my-4 transition-all duration-200 ${
      isFullscreen ? "z-[100]" : ""
    }`}>
      <div 
        className={
          isFullscreen 
            ? "fixed inset-0 bg-layout-content z-[100] flex flex-col px-6 py-10 w-screen h-screen" 
            : "relative w-full"
        }
      >
        {/* Header / Controls */}
        <div className={
          isFullscreen 
            ? "flex items-center justify-between pb-3 border-b border-dashed border-border mb-4 select-none" 
            : `absolute top-2 right-2 flex items-center gap-1.5 transition-opacity duration-200 z-20 select-none ${
                isEditorFocused || isFullscreen ? "opacity-100" : "opacity-0 group-hover:opacity-100"
              }`
        }>
          {isFullscreen && (
            <span className="text-sm font-semibold text-muted-foreground font-mono">
              PlantUML Diagram Preview
            </span>
          )}

          <div className="flex items-center gap-1.5">
            {/* Copy code button */}
            <Button
              variant="outline"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-foreground bg-background/80"
              onClick={copyToClipboard}
              title="Copy diagram source"
            >
              {isCopied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
            </Button>

            {/* Maximize/Minimize button */}
            <Button
              variant="outline"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-foreground bg-background/80"
              onClick={() => setIsFullscreen(!isFullscreen)}
              title={isFullscreen ? "Exit fullscreen" : "Maximize diagram"}
            >
              {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            </Button>

            {/* Mode switch tabs (only if editable) */}
            {editable && (
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
            )}
          </div>
        </div>

        {/* Editor / Render Body */}
        <div className={isFullscreen ? "flex-1 min-h-0 relative w-full" : "relative w-full"}>
          {/* CODE MODE */}
          <div className={mode === "code" ? (isFullscreen ? "h-full flex flex-col" : "block") : "hidden"}>
            <pre className={`relative p-4 font-mono text-sm leading-relaxed overflow-x-auto bg-zinc-950 text-zinc-50 border border-border m-0 rounded-lg ${
              isFullscreen ? "h-full flex-1" : ""
            }`}>
              <NodeViewContent className="outline-none" />
            </pre>
          </div>

          {/* PREVIEW MODE */}
          <div 
            className={`${
              isFullscreen ? "h-full w-full" : "h-[400px] w-full border border-border rounded-lg overflow-hidden"
            } transition-all duration-200 ${
              mode === "preview" ? "block" : "hidden"
            }`}
          >
            {codeText.trim() ? (
              <PlantUMLBrowserPreview 
                content={codeText} 
                onContentChange={editable ? handleContentChange : undefined} 
              />
            ) : (
              <div className="flex items-center justify-center h-full text-xs text-muted-foreground italic font-mono bg-layout-content border border-dashed border-border rounded-lg">
                Empty diagram...
              </div>
            )}
          </div>
        </div>
      </div>
    </NodeViewWrapper>
  );
}
