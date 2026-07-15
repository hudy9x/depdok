import { MarkdownPreview } from "../PreviewMarkdown/MarkdownPreview";
import { MermaidPreview } from "./MermaidPreview";
// import { PlantUMLPreview } from "../PreviewPlantUML";
import { PlantUMLBrowserPreview } from "../PreviewPlantUML/PlantUMLBrowserPreview";
import { PlantUMLNativePreview } from "../PreviewPlantUML/PlantUMLNativePreview";
import { TodoPreview } from "../PreviewTodo/TodoPreview";
import { ExcalidrawPreview } from "../PreviewExcalidraw";
import { KnowledgeGraphPreview } from "../KnowledgeGraph/KnowledgeGraphPreview";
import { isKnowledgeGraphFile } from "@/lib/knowledgeGraph";
import { isImageFile } from "@/lib/fileSupport";

interface PreviewPanelProps {
  content: string;
  fileExtension: string | null;
  filePath?: string;
  editable?: boolean;
  onContentChange?: (content: string) => void;
}

import { PreviewImage } from "../PreviewImage";

export function PreviewPanel({
  content,
  fileExtension,
  filePath,
  editable = false,
  onContentChange
}: PreviewPanelProps) {

  if (!fileExtension) {
    return (
      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
        No file loaded
      </div>
    );
  }

  if (fileExtension === "md" && isKnowledgeGraphFile(filePath)) {
    return <KnowledgeGraphPreview filePath={filePath || ""} />;
  }

  if (["md", "txt"].includes(fileExtension)) {
    return (
      <MarkdownPreview
        content={content}
        editable={editable}
        onContentChange={onContentChange}
        filePath={filePath}
      />
    );
  }

  if (filePath && isImageFile(filePath)) {
    return <PreviewImage filePath={filePath} />;
  }

  if (fileExtension === "mmd") {
    return <MermaidPreview content={content} />;
  }

  if (["puml", "pu"].includes(fileExtension)) {
    return <PlantUMLBrowserPreview content={content} onContentChange={onContentChange} />;
    // return <PlantUMLPreview content={content} onContentChange={onContentChange} />;
  }

  if (["npuml", "nplantuml"].includes(fileExtension)) {
    return <PlantUMLNativePreview content={content} onContentChange={onContentChange} />;
  }

  if (fileExtension === "todo") {
    return (
      <TodoPreview
        content={content}
        editable={editable}
        onContentChange={onContentChange}
        filePath={filePath}
      />
    );
  }

  if (fileExtension === "excalidraw") {
    return <ExcalidrawPreview content={content} filePath={filePath} onContentChange={onContentChange} />;
  }


  return (
    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
      No preview available for .{fileExtension} files
    </div>
  );
}
