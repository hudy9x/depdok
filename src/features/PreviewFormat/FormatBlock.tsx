import { useState, useRef } from "react";
import { ChevronDown, ChevronRight, Copy, Check } from "lucide-react";
import { FormatBlockType } from "@/lib/format-parser";
import { formatBlock } from "@/lib/monaco-actions/format-formatter";
import { JsonTreeView, YamlTreeView, XmlTreeView } from "./DataTreeView";

interface FormatBlockProps {
  type: FormatBlockType;
  label?: string;
  content: string;
  editable?: boolean;
  onContentChange?: (newContent: string) => void;
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

export function FormatBlock({ type, label, content, editable = false, onContentChange }: FormatBlockProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [copied, setCopied] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-muted/30">
        {/* Collapse toggle */}
        <button
          className="flex items-center gap-2 flex-1 text-left hover:opacity-70 transition-opacity min-w-0"
          onClick={() => setCollapsed((c) => !c)}
        >
          <span className={`shrink-0 text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded border ${BADGE_COLORS[type]}`}>
            {type}
          </span>
          {label && (
            <span className="text-xs text-muted-foreground truncate">{label}</span>
          )}
          {collapsed ? (
            <ChevronRight className="shrink-0 ml-auto w-3.5 h-3.5 text-muted-foreground" />
          ) : (
            <ChevronDown className="shrink-0 ml-auto w-3.5 h-3.5 text-muted-foreground" />
          )}
        </button>

        {/* Copy button */}
        <button
          onClick={handleCopy}
          className="shrink-0 flex items-center justify-center w-6 h-6 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          title="Copy content"
        >
          {copied ? (
            <Check className="w-3.5 h-3.5 text-green-500" />
          ) : (
            <Copy className="w-3.5 h-3.5" />
          )}
        </button>
      </div>

      {/* Body */}
      {!collapsed && (
        <div className="border-t border-border bg-accent">
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
    </div>
  );
}
