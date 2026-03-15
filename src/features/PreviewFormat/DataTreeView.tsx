import { useState } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";
import * as yaml from "js-yaml";

// ─── Value types ─────────────────────────────────────────────────────────────

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

interface TreeNodeProps {
  label: string;
  value: JsonValue;
  depth?: number;
}

// ─── Color tokens ─────────────────────────────────────────────────────────────

function getValueColor(value: JsonValue): string {
  if (value === null) return "text-rose-600 dark:text-rose-400";
  if (typeof value === "boolean") return "text-orange-600 dark:text-orange-400";
  if (typeof value === "number") return "text-sky-700 dark:text-sky-400";
  if (typeof value === "string") return "text-emerald-700 dark:text-emerald-400";
  return "text-foreground";
}

function ValuePill({ value }: { value: JsonValue }) {
  if (typeof value === "string") {
    return <span className={`${getValueColor(value)} font-mono text-xs`}>"{value}"</span>;
  }
  if (value === null) {
    return <span className="text-rose-600 dark:text-rose-400 font-mono text-xs italic">null</span>;
  }
  if (typeof value === "boolean") {
    return <span className="text-orange-600 dark:text-orange-400 font-mono text-xs">{String(value)}</span>;
  }
  if (typeof value === "number") {
    return <span className="text-sky-700 dark:text-sky-400 font-mono text-xs">{value}</span>;
  }
  return null;
}

// ─── Tree Node ────────────────────────────────────────────────────────────────

function TreeNode({ label, value, depth = 0 }: TreeNodeProps) {
  const isExpandable = value !== null && typeof value === "object";
  const isArray = Array.isArray(value);
  const [collapsed, setCollapsed] = useState(depth > 2);

  const children: [string, JsonValue][] = isExpandable
    ? isArray
      ? (value as JsonValue[]).map((v, i) => [String(i), v])
      : Object.entries(value as Record<string, JsonValue>)
    : [];

  const childCount = children.length;
  const suffix = isArray ? `[${childCount}]` : `{${childCount}}`;

  return (
    <div className="relative flex flex-col">
      {/* Vertical connector line from parent */}
      {depth > 0 && (
        <span
          className="absolute left-0 top-0 bottom-0 w-px bg-border"
          style={{ left: -13 }}
        />
      )}
      {/* Horizontal connector line */}
      {depth > 0 && (
        <span
          className="absolute w-3 h-px bg-border"
          style={{ left: -13, top: 14 }}
        />
      )}

      {/* Node row */}
      <div
        className={`flex items-center gap-1.5 py-0.5 px-2 rounded-md group
          ${isExpandable ? "cursor-pointer hover:bg-muted/60 transition-colors" : ""}`}
        onClick={isExpandable ? () => setCollapsed((c) => !c) : undefined}
      >
        {/* Expand/collapse icon */}
        <span className="w-4 h-4 flex items-center justify-center shrink-0">
          {isExpandable ? (
            collapsed ? (
              <ChevronRight className="w-3 h-3 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-3 h-3 text-muted-foreground" />
            )
          ) : (
            <span className="w-1.5 h-1.5 rounded-full bg-border block" />
          )}
        </span>

        {/* Key */}
        <span className="text-xs font-mono text-blue-900 dark:text-blue-400 shrink-0">{label}</span>
        <span className="text-xs text-muted-foreground shrink-0">:</span>

        {/* Value or type summary */}
        {isExpandable ? (
          <span className="text-xs text-muted-foreground/60 italic">
            {suffix}
          </span>
        ) : (
          <ValuePill value={value} />
        )}
      </div>

      {/* Children */}
      {isExpandable && !collapsed && (
        <div className="relative pl-[26px] flex flex-col">
          {/* Vertical line connecting all children */}
          <span
            className="absolute top-0 bottom-2 w-px bg-border"
            style={{ left: 13 }}
          />
          {children.map(([k, v]) => (
            <TreeNode
              key={k}
              label={k}
              value={v}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── XML node renderer ────────────────────────────────────────────────────────

function XmlNode({ node, depth = 0 }: { node: Element | ChildNode; depth?: number }) {
  const [collapsed, setCollapsed] = useState(depth > 1);

  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent?.trim();
    if (!text) return null;
    return (
      <div className="flex items-center gap-1.5 py-0.5 px-2 pl-6">
        <span className="w-1.5 h-1.5 rounded-full bg-border block shrink-0" />
        <span className="text-xs font-mono text-emerald-700 dark:text-emerald-400">"{text}"</span>
      </div>
    );
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return null;
  const el = node as Element;
  const childNodes = Array.from(el.childNodes).filter(
    (c) => c.nodeType === Node.ELEMENT_NODE || (c.nodeType === Node.TEXT_NODE && c.textContent?.trim())
  );
  const hasChildren = childNodes.length > 0;
  const attrs = Array.from(el.attributes);

  return (
    <div className="relative flex flex-col">
      {depth > 0 && <span className="absolute left-0 top-0 bottom-0 w-px bg-border" style={{ left: -13 }} />}
      {depth > 0 && <span className="absolute w-3 h-px bg-border" style={{ left: -13, top: 14 }} />}

      <div
        className={`flex items-start gap-1.5 py-0.5 px-2 rounded-md
          ${hasChildren ? "cursor-pointer hover:bg-muted/60 transition-colors" : ""}`}
        onClick={hasChildren ? () => setCollapsed((c) => !c) : undefined}
      >
        <span className="w-4 h-4 flex items-center justify-center shrink-0 mt-0.5">
          {hasChildren ? (
            collapsed ? <ChevronRight className="w-3 h-3 text-muted-foreground" /> : <ChevronDown className="w-3 h-3 text-muted-foreground" />
          ) : (
            <span className="w-1.5 h-1.5 rounded-full bg-border block" />
          )}
        </span>
        <div className="flex flex-wrap gap-1 items-baseline">
          <span className="text-xs font-mono text-orange-600 dark:text-orange-400">&lt;{el.tagName}&gt;</span>
          {attrs.map((a) => (
            <span key={a.name} className="text-xs font-mono">
              <span className="text-yellow-600 dark:text-yellow-400">{a.name}</span>
              <span className="text-muted-foreground">=</span>
              <span className="text-emerald-700 dark:text-emerald-400">"{a.value}"</span>
            </span>
          ))}
          {!hasChildren && el.textContent?.trim() && (
            <span className="text-xs font-mono text-emerald-700 dark:text-emerald-400">"{el.textContent.trim()}"</span>
          )}
          {hasChildren && (
            <span className="text-xs text-muted-foreground/60 italic">{childNodes.length} children</span>
          )}
        </div>
      </div>

      {hasChildren && !collapsed && (
        <div className="relative pl-[26px] flex flex-col">
          <span className="absolute top-0 bottom-2 w-px bg-border" style={{ left: 13 }} />
          {childNodes.map((c, i) => (
            <XmlNode key={i} node={c} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Public components ─────────────────────────────────────────────────────────

export function JsonTreeView({ content }: { content: string }) {
  let parsed: JsonValue;
  try {
    parsed = JSON.parse(content.trim());
  } catch {
    return <ParseError type="JSON" />;
  }

  // Root: always an object or array
  if (parsed === null || typeof parsed !== "object") {
    return (
      <div className="flex items-center gap-2 py-1 px-2">
        <ValuePill value={parsed} />
      </div>
    );
  }

  const entries: [string, JsonValue][] = Array.isArray(parsed)
    ? parsed.map((v, i) => [String(i), v])
    : Object.entries(parsed as Record<string, JsonValue>);

  return (
    <div className="flex flex-col gap-0.5 py-2 px-2">
      {entries.map(([k, v]) => (
        <TreeNode key={k} label={k} value={v} depth={0} />
      ))}
    </div>
  );
}

export function YamlTreeView({ content }: { content: string }) {
  let parsed: JsonValue;
  try {
    parsed = yaml.load(content.trim()) as JsonValue;
  } catch {
    return <ParseError type="YAML" />;
  }
  return <JsonTreeView content={JSON.stringify(parsed)} />;
}

export function XmlTreeView({ content, isHtml = false }: { content: string; isHtml?: boolean }) {
  let root: Element;
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(content.trim(), isHtml ? "text/html" : "application/xml");
    const errNode = doc.querySelector("parsererror");
    if (errNode) throw new Error("Parse error");
    root = isHtml ? doc.body : doc.documentElement;
  } catch {
    return <ParseError type={isHtml ? "HTML" : "XML"} />;
  }

  const children = Array.from(root.childNodes).filter(
    (c) => c.nodeType === Node.ELEMENT_NODE || (c.nodeType === Node.TEXT_NODE && c.textContent?.trim())
  );

  return (
    <div className="flex flex-col gap-0.5 py-2 px-2">
      {children.map((c, i) => (
        <XmlNode key={i} node={c} depth={0} />
      ))}
    </div>
  );
}

function ParseError({ type }: { type: string }) {
  return (
    <div className="px-3 py-2 text-xs text-rose-400 font-mono">
      ⚠ Invalid {type}
    </div>
  );
}
