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

  console.log('PreviewPanel', fileExtension, editable)

  if (!fileExtension) {
    return (
      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
        No file loaded
      </div>
    );
  }

  if (fileExtension === "md") {
    console.log('run in here :D:D:D:D:D:', fileExtension)
    console.log('content being passed to MarkdownPreview:', content?.substring(0, 100), 'length:', content?.length)
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
