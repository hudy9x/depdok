import { MarkdownPreview } from "./MarkdownPreview";
import { MermaidPreview } from "./MermaidPreview";
import { PlantUMLPreview } from "./PlantUMLPreview";
import { TodoPreview } from "../PreviewTodo/TodoPreview";

interface PreviewPanelProps {
  content: string;
  fileExtension: string | null;
  editable?: boolean;
  onContentChange?: (content: string) => void;
}

export function PreviewPanel({
  content,
  fileExtension,
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

  if (["md", "txt"].includes(fileExtension)) {
    return (
      <MarkdownPreview
        content={content}
        editable={editable}
        onContentChange={onContentChange}
      />
    );
  }

  if (fileExtension === "mmd") {
    return <MermaidPreview content={content} />;
  }

  if (["puml", "pu"].includes(fileExtension)) {
    return <PlantUMLPreview content={content} />;
  }

  if (fileExtension === "todo") {
    return (
      <TodoPreview
        content={content}
        editable={editable}
        onContentChange={onContentChange}
      />
    );
  }

  return (
    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
      No preview available for .{fileExtension} files
    </div>
  );
}
