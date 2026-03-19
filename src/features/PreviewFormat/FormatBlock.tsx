import { useState, useRef } from "react";
import { ChevronDown, ChevronRight, Copy, Check, Trash, GripVertical } from "lucide-react";
import { FormatBlockType } from "@/lib/format-parser";
import { formatBlock } from "@/lib/monaco-actions/format-formatter";
import { JsonTreeView, YamlTreeView, XmlTreeView } from "./DataTreeView";
import { Handle, Position, useConnection, useNodeId } from "@xyflow/react";

export interface FormatBlockNodeData extends Record<string, unknown> {
  type: FormatBlockType;
  label?: string;
  content: string;
  editable?: boolean;
  onContentChange?: (newContent: string) => void;
  // Compare specific
  onDelete?: () => void;
}

interface FormatBlockProps {
  data: FormatBlockNodeData;
}

const BADGE_COLORS: Record<FormatBlockType, string> = {
  json: "bg-yellow-500/20 text-yellow-600 border-yellow-500/30",
  xml: "bg-blue-500/20 text-blue-600 border-blue-500/30",
  yaml: "bg-purple-500/20 text-purple-600 border-purple-500/30",
  html: "bg-orange-500/20 text-orange-600 border-orange-500/30",
  text: "bg-muted text-muted-foreground border-border",
};

function TreeView({ type, content }: { type: FormatBlockType; content: string }) {
  switch (type) {
    case "json": return <JsonTreeView content={content} />;
    case "yaml": return <YamlTreeView content={content} />;
    case "xml": return <XmlTreeView content={content} />;
    case "html": return <XmlTreeView content={content} isHtml />;
    default: return null;
  }
}

export function FormatBlock({ data }: FormatBlockProps) {
  const { type, label, content, editable = false, onContentChange, onDelete } = data;
  const [collapsed, setCollapsed] = useState(false);
  const [copied, setCopied] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const nodeId = useNodeId();
  
  const connection = useConnection();
  const connectionNodeId = connection?.inProgress ? connection.fromNode?.id : null;
  const connectionSourceType = connection?.inProgress ? (connection.fromNode?.data as unknown as FormatBlockNodeData)?.type : null;

  const isConnecting = connection?.inProgress && connectionNodeId !== nodeId;
  const isConnectableMatch = isConnecting ? connectionSourceType === type : null;

  let highlightClasses = "border-border";
  if (isConnectableMatch === true) {
    highlightClasses = "border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.2)] ring-1 ring-emerald-500/50 transition-all";
  } else if (isConnectableMatch === false) {
    highlightClasses = "border-red-500/50 opacity-40 transition-all grayscale duration-300";
  } else {
    highlightClasses = "border-border transition-all duration-300";
  }

  if (type === "text") {
    return (
      <p className="text-xs text-muted-foreground px-1 py-0.5 select-none">
        {content}
      </p>
    );
  }

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    let textToCopy = content;
    try {
      if (content.trim()) textToCopy = formatBlock(type, content);
    } catch {
      // fall back to raw content if formatting fails
    }
    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const handleTextareaInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };

  return (
    <div className={`rounded-lg border bg-card overflow-hidden min-w-[300px] shadow-sm ${highlightClasses}`}>
      <Handle type="target" position={Position.Left} className="!w-2.5 !h-6 !rounded-l-full !rounded-r-none !bg-muted-foreground !border-y-2 !border-l-2 !border-r-0 !border-background !-ml-[5px]" />

      {/* Header */}
      <div className="custom-drag-handle flex items-center gap-1.5 px-3 py-2 bg-muted/30 cursor-grab active:cursor-grabbing">
        {/* Drag Handle */}
        <div
          className="shrink-0 flex items-center justify-center -ml-1.5 p-1 rounded hover:bg-muted/50 text-muted-foreground/40 hover:text-muted-foreground transition-colors"
          title="Drag block"
        >
          <GripVertical className="w-4 h-4" />
        </div>

        {/* Block Info */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className={`shrink-0 text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded border ${BADGE_COLORS[type]}`}>
            {type}
          </span>
          {label && (
            <span className="text-xs text-muted-foreground truncate">{label}</span>
          )}
        </div>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="shrink-0 flex items-center justify-center w-6 h-6 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground nodrag"
          title={collapsed ? "Expand block" : "Collapse block"}
        >
          {collapsed ? (
            <ChevronRight className="w-3.5 h-3.5" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5" />
          )}
        </button>



        {/* Copy button */}
        <button
          onClick={handleCopy}
          className="shrink-0 flex items-center justify-center w-6 h-6 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground nodrag"
          title="Copy content"
        >
          {copied ? (
            <Check className="w-3.5 h-3.5 text-green-500" />
          ) : (
            <Copy className="w-3.5 h-3.5" />
          )}
        </button>

        {/* Delete button */}
        {onDelete && (
          <button
            onClick={onDelete}
            className="shrink-0 flex items-center justify-center w-6 h-6 rounded hover:bg-red-500/20 transition-colors text-muted-foreground hover:text-red-500 nodrag"
            title="Delete block"
          >
            <Trash className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Body */}
      {!collapsed && (
        <div className="border-t border-border bg-card nodrag">
          {/* Inline input — only in preview-only (editable) mode */}
          {editable && (
            <div className="px-4 pt-3 pb-2 border-b border-border/50">
              <textarea
                ref={textareaRef}
                value={content}
                placeholder={`Paste or type ${type.toUpperCase()} here…`}
                onChange={(e) => onContentChange?.(e.target.value)}
                onInput={handleTextareaInput}
                rows={1}
                className="w-full resize-none bg-transparent text-xs font-mono text-foreground placeholder:text-muted-foreground/50 outline-none leading-relaxed overflow-hidden"
                style={{ minHeight: "24px" }}
              />
            </div>
          )}

          {/* Tree view */}
          {content.trim() ? (
            <div className="overflow-auto max-h-[480px] bg-background/50">
              <TreeView type={type} content={content} />
            </div>
          ) : (
            <div className="px-4 py-3 text-xs text-muted-foreground/50 italic">
              empty block
            </div>
          )}
        </div>
      )}

      <Handle type="source" position={Position.Right} className="!w-2.5 !h-6 !rounded-r-full !rounded-l-none !bg-muted-foreground !border-y-2 !border-r-2 !border-l-0 !border-background !-mr-[5px]" />
    </div>
  );
}
