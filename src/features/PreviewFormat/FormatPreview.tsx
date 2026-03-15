import { Braces, Code, FileCode, FileJson } from "lucide-react";
import { parseFormatFile, appendBlock, replaceBlockContent, FormatBlockType } from "@/lib/format-parser";
import { FormatBlock } from "./FormatBlock";

interface FormatPreviewProps {
  content: string;
  editable?: boolean;
  onContentChange?: (newContent: string) => void;
}

const BLOCK_TYPES: { type: FormatBlockType; label: string; icon: React.ReactNode; color: string }[] = [
  { type: "json",  label: "JSON",  icon: <FileJson className="w-3.5 h-3.5" />, color: "text-yellow-600 dark:text-yellow-400 border-yellow-500/40 hover:bg-yellow-500/10" },
  { type: "xml",   label: "XML",   icon: <FileCode className="w-3.5 h-3.5" />, color: "text-blue-600 dark:text-blue-400 border-blue-500/40 hover:bg-blue-500/10" },
  { type: "html",  label: "HTML",  icon: <Code className="w-3.5 h-3.5" />,     color: "text-orange-600 dark:text-orange-400 border-orange-500/40 hover:bg-orange-500/10" },
  { type: "yaml",  label: "YAML",  icon: <Braces className="w-3.5 h-3.5" />,  color: "text-purple-600 dark:text-purple-400 border-purple-500/40 hover:bg-purple-500/10" },
];

export function FormatPreview({ content, editable = false, onContentChange }: FormatPreviewProps) {
  const blocks = parseFormatFile(content);
  const hasTypedBlocks = blocks.some((b) => b.type !== "text");

  const handleAddBlock = (type: FormatBlockType) => {
    const updated = appendBlock(content, type);
    onContentChange?.(updated);
  };

  const handleBlockContentChange = (blockIndex: number, newBlockContent: string) => {
    const updated = replaceBlockContent(content, blocks, blockIndex, newBlockContent);
    onContentChange?.(updated);
  };

  // Empty state
  if (!hasTypedBlocks) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-sm text-muted-foreground">
          No blocks yet. Add a section to get started.
        </p>
        <div className="flex items-center gap-2 flex-wrap justify-center">
          {BLOCK_TYPES.map(({ type, label, icon, color }) => (
            <button
              key={type}
              onClick={() => handleAddBlock(type)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${color}`}
            >
              {icon}
              {label}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground/60">
          Or type <code className="px-1 rounded bg-muted">~~~json</code> directly in the editor
        </p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      {/* Scrollable block list — padded bottom so buttons don't cover last block */}
      <div className="w-full h-full overflow-y-auto pb-14">
        <div className="flex flex-col gap-3 p-4">
          {blocks.map((block, index) => (
            <FormatBlock
              key={index}
              type={block.type}
              label={block.label}
              content={block.content}
              editable={editable}
              onContentChange={(newContent) => handleBlockContentChange(index, newContent)}
            />
          ))}
        </div>
      </div>

      {/* Add section buttons — absolutely pinned to bottom */}
      <div className="absolute bottom-0 left-0 right-0 flex items-center gap-2 px-4 py-2 bg-background/80 backdrop-blur border-t border-border flex-wrap">
        {BLOCK_TYPES.map(({ type, label, icon, color }) => (
          <button
            key={type}
            onClick={() => handleAddBlock(type)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-medium transition-colors ${color}`}
          >
            {icon}
            + {label}
          </button>
        ))}
      </div>
    </div>
  );
}
