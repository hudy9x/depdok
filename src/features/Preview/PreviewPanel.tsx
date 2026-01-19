import { MarkdownPreview } from "./MarkdownPreview";
import { MermaidPreview } from "./MermaidPreview";

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

  if (fileExtension === "md") {
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

  return (
    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
      No preview available for .{fileExtension} files
    </div>
  );
}
