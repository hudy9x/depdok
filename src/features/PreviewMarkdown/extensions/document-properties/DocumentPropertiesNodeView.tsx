import { useState, useEffect, useRef, useMemo } from "react";
import { NodeViewWrapper, NodeViewProps } from "@tiptap/react";
import { useAtomValue, useSetAtom } from "jotai";
import { useNavigate } from "react-router-dom";
import {
  Calendar,
  ChevronDown,
  ChevronRight,
  Clock,
  ExternalLink,
  FileText,
  Heading,
  Link2,
  Plus,
  Search,
  Tag,
  User,
  UserCheck,
  X,
  AlignLeft,
  Folder,
} from "lucide-react";

import { workspaceRootAtom } from "@/features/FileExplorer/store";
import { createTabAtom } from "@/stores/TabStore";
import { fileReloadVersionAtomFamily } from "@/stores/EditorStore";
import { openUrl } from "@tauri-apps/plugin-opener";
import { FileIcon } from "@/components/FileIcon";
import { fuzzySearchFiles, SearchResult } from "@/features/FileSearchDialog/api";
import { getFileFsMetadata } from "@/lib/fileOperations";
import { stringifyFrontmatter } from "../../utils/frontmatter";

export function DocumentPropertiesNodeView(props: NodeViewProps) {
  const { node, updateAttributes, editor } = props;
  const isEditable = editor.isEditable;
  const metadata: Record<string, any> = node.attrs.metadata || {};
  const filePath: string = node.attrs.filePath || "";

  const fileReloadVersion = useAtomValue(
    useMemo(() => fileReloadVersionAtomFamily(filePath), [filePath])
  );

  const [isExpanded, setIsExpanded] = useState(false);
  const [newTagInput, setNewTagInput] = useState("");
  const [isAddingTag, setIsAddingTag] = useState(false);

  // OS Filesystem Metadata (Created at & Updated at) - read-only, loaded on mount & reloads
  const [fsMetadata, setFsMetadata] = useState<{
    created_at: string | null;
    updated_at: string | null;
  } | null>(null);

  useEffect(() => {
    if (!filePath || filePath.startsWith("UNTITLED://")) return;
    getFileFsMetadata(filePath)
      .then((data) => {
        setFsMetadata({
          created_at: data.created_at,
          updated_at: data.updated_at,
        });
      })
      .catch((err) => {
        console.warn("[DocumentProperties] Failed to fetch fs metadata:", err);
      });
  }, [filePath, fileReloadVersion]);

  // Reference search popover state
  const [isAddingRef, setIsAddingRef] = useState(false);
  const [refSearchQuery, setRefSearchQuery] = useState("");
  const [refSearchResults, setRefSearchResults] = useState<SearchResult[]>([]);
  const [isSearchingFiles, setIsSearchingFiles] = useState(false);
  const refPopoverRef = useRef<HTMLDivElement>(null);
  const addPropPopoverRef = useRef<HTMLDivElement>(null);

  const [isAddingProp, setIsAddingProp] = useState(false);
  const [newPropKey, setNewPropKey] = useState("");
  const [newPropVal, setNewPropVal] = useState("");

  const workspaceRoot = useAtomValue(workspaceRootAtom);
  const createTab = useSetAtom(createTabAtom);
  const navigate = useNavigate();

  // Search workspace files when ref search query changes
  useEffect(() => {
    if (!isAddingRef || !workspaceRoot) {
      setRefSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearchingFiles(true);
      try {
        const results = await fuzzySearchFiles(refSearchQuery.trim(), 25);
        setRefSearchResults(results || []);
      } catch (error) {
        console.error("Failed to search workspace files for reference:", error);
        setRefSearchResults([]);
      } finally {
        setIsSearchingFiles(false);
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [refSearchQuery, isAddingRef, workspaceRoot]);

  // Click outside listener for popovers
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (refPopoverRef.current && !refPopoverRef.current.contains(e.target as Node)) {
        setIsAddingRef(false);
      }
      if (addPropPopoverRef.current && !addPropPopoverRef.current.contains(e.target as Node)) {
        setIsAddingProp(false);
      }
    };

    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, []);

  // Helper to commit changes to TipTap node attributes
  const commitMetadata = (updated: Record<string, any>) => {
    const cleaned: Record<string, any> = {};
    for (const [key, value] of Object.entries(updated)) {
      if (value !== undefined && value !== null) {
        if (typeof value === "string") {
          if (value.trim() !== "") {
            cleaned[key] = value;
          }
        } else if (Array.isArray(value)) {
          if (value.length > 0) {
            cleaned[key] = value;
          }
        } else {
          cleaned[key] = value;
        }
      }
    }

    const raw = stringifyFrontmatter(cleaned);
    updateAttributes({
      metadata: cleaned,
      raw,
    });
  };

  const handleUpdateField = (key: string, value: any) => {
    const updated = { ...metadata, [key]: value };
    commitMetadata(updated);
  };

  const handleRemoveField = (key: string) => {
    const updated = { ...metadata };
    delete updated[key];
    commitMetadata(updated);
  };

  // Extract structured values
  const title = typeof metadata.title === "string" ? metadata.title : "";
  const desc =
    typeof metadata.desc === "string"
      ? metadata.desc
      : typeof metadata.description === "string"
        ? metadata.description
        : "";
  const author = typeof metadata.author === "string" ? metadata.author : "";
  const updatedBy = typeof metadata.updated_by === "string" ? metadata.updated_by : "";

  // Resolved timestamps from OS filesystem metadata (with frontmatter fallback)
  const createdAtDisplay =
    fsMetadata?.created_at ||
    (metadata.created_at ? String(metadata.created_at) : null) ||
    (metadata.created ? String(metadata.created) : null);

  const updatedAtDisplay =
    fsMetadata?.updated_at ||
    (metadata.updated_at ? String(metadata.updated_at) : null) ||
    (metadata.date ? String(metadata.date) : null) ||
    (metadata.updated ? String(metadata.updated) : null);

  // References list
  const references: string[] = Array.isArray(metadata.references)
    ? metadata.references.filter((r) => typeof r === "string")
    : typeof metadata.references === "string"
      ? [metadata.references]
      : [];

  // Tags list
  const tags: string[] = Array.isArray(metadata.tags)
    ? metadata.tags.filter((t) => typeof t === "string")
    : typeof metadata.tags === "string"
      ? metadata.tags.split(",").map((t) => t.trim()).filter(Boolean)
      : [];

  // Filter out handled keys for custom properties
  const knownKeys = new Set([
    "title",
    "desc",
    "description",
    "author",
    "updated_by",
    "image",
    "cover",
    "references",
    "tags",
    "date",
    "updated_at",
    "created_at",
    "created",
    "updated",
  ]);

  const customProperties = Object.entries(metadata).filter(([key]) => !knownKeys.has(key));

  const handleAddTag = () => {
    const trimmed = newTagInput.trim().replace(/^#/, "");
    if (trimmed && !tags.includes(trimmed)) {
      const updatedTags = [...tags, trimmed];
      handleUpdateField("tags", updatedTags);
    }
    setNewTagInput("");
    setIsAddingTag(false);
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const updatedTags = tags.filter((t) => t !== tagToRemove);
    handleUpdateField("tags", updatedTags.length > 0 ? updatedTags : undefined);
  };

  const handleAddReferencePath = (refPath: string) => {
    const trimmed = refPath.trim();
    if (trimmed && !references.includes(trimmed)) {
      const updatedRefs = [...references, trimmed];
      handleUpdateField("references", updatedRefs);
    }
    setRefSearchQuery("");
    setIsAddingRef(false);
  };

  const handleRemoveReference = (refToRemove: string) => {
    const updatedRefs = references.filter((r) => r !== refToRemove);
    handleUpdateField("references", updatedRefs.length > 0 ? updatedRefs : undefined);
  };

  const handleAddCustomProp = () => {
    const trimmedKey = newPropKey.trim().toLowerCase().replace(/\s+/g, "_");
    const trimmedVal = newPropVal.trim();
    if (trimmedKey && trimmedVal) {
      handleUpdateField(trimmedKey, trimmedVal);
    }
    setNewPropKey("");
    setNewPropVal("");
    setIsAddingProp(false);
  };

  const handleReferenceClick = (refPath: string) => {
    if (refPath.startsWith("http://") || refPath.startsWith("https://")) {
      openUrl(refPath);
      return;
    }

    let fullPath = refPath;
    if (refPath.startsWith("/") && workspaceRoot) {
      const rootNormalized = workspaceRoot.replace(/[\/\\]+$/, "");
      fullPath = `${rootNormalized}${refPath}`;
    } else if (filePath) {
      const lastSlash = Math.max(filePath.lastIndexOf("/"), filePath.lastIndexOf("\\"));
      const dir = lastSlash >= 0 ? filePath.substring(0, lastSlash) : "";
      const parts = dir.split(/[/\\]/);
      for (const seg of refPath.split(/[/\\]/)) {
        if (seg === "..") parts.pop();
        else if (seg !== ".") parts.push(seg);
      }
      fullPath = parts.join("/");
    }

    const fileName = fullPath.split(/[/\\]/).pop() || "Untitled";
    createTab({ filePath: fullPath, fileName, switchTo: true, isPreview: true });
    navigate("/editor");
  };

  const availableQuickProps = [
    { key: "title", label: "Title", icon: Heading, exists: !!metadata.title },
    { key: "desc", label: "Description", icon: AlignLeft, exists: !!(metadata.desc || metadata.description) },
    { key: "author", label: "Author", icon: User, exists: !!metadata.author },
    { key: "updated_by", label: "Updated by", icon: UserCheck, exists: !!metadata.updated_by },
    { key: "tags", label: "Tags", icon: Tag, exists: tags.length > 0 },
    { key: "references", label: "References", icon: Link2, exists: references.length > 0 },
  ];

  const hasAnyField =
    title ||
    desc ||
    author ||
    updatedBy ||
    createdAtDisplay ||
    updatedAtDisplay ||
    tags.length > 0 ||
    references.length > 0 ||
    customProperties.length > 0;

  if (!hasAnyField && !isEditable) {
    return (
      <NodeViewWrapper className="document-properties-node select-none my-3" contentEditable={false}>
        <div className="hidden" />
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper
      className="document-properties-node select-none not-prose mb-6 mt-2 relative z-30"
      contentEditable={false}
    >
      <div className="rounded-xl border border-border/50 bg-muted/20 backdrop-blur-xs p-3.5 sm:p-4 space-y-3 shadow-2xs transition-all relative">
        {/* Header bar: DOCUMENT PROPERTIES (left) and HIDE/SHOW (right) */}
        <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground uppercase tracking-wider select-none">
          <div
            className="flex items-center gap-1.5 cursor-pointer hover:text-foreground transition-colors"
            onClick={() => setIsExpanded((v) => !v)}
          >
            {isExpanded ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5" />
            )}
            <span>Document Properties</span>
          </div>

          <div className="flex items-center gap-2">
            {isEditable && (
              <div className="relative inline-block" ref={addPropPopoverRef}>
                <button
                  type="button"
                  onClick={() => setIsAddingProp((v) => !v)}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-background/80 hover:bg-secondary border border-border/50 text-foreground transition-colors cursor-pointer"
                  title="Add property"
                >
                  <Plus className="w-3 h-3 text-muted-foreground" />
                  <span>Property</span>
                </button>

                {isAddingProp && (
                  <div className="absolute right-0 top-6 z-50 w-52 p-2 bg-popover text-popover-foreground border border-border rounded-lg shadow-xl space-y-2">
                    <div className="text-[11px] font-semibold text-muted-foreground px-1 pb-1 border-b border-border/40">
                      Add Property
                    </div>
                    <div className="space-y-1">
                      {availableQuickProps
                        .filter((p) => !p.exists)
                        .map((p) => (
                          <button
                            key={p.key}
                            type="button"
                            onClick={() => {
                              if (p.key === "tags") {
                                handleUpdateField("tags", ["tag"]);
                              } else if (p.key === "references") {
                                handleUpdateField("references", ["/overview.md"]);
                              } else {
                                handleUpdateField(p.key, "");
                              }
                              setIsAddingProp(false);
                            }}
                            className="w-full flex items-center gap-2 px-2 py-1 text-xs rounded hover:bg-secondary text-left text-foreground cursor-pointer"
                          >
                            <p.icon className="w-3 h-3 text-muted-foreground" />
                            <span>{p.label}</span>
                          </button>
                        ))}
                    </div>

                    {/* Custom property form */}
                    <div className="pt-1.5 border-t border-border/40 space-y-1.5">
                      <div className="text-[10px] text-muted-foreground px-1">Custom field</div>
                      <input
                        type="text"
                        placeholder="Key (e.g. status)"
                        value={newPropKey}
                        onChange={(e) => setNewPropKey(e.target.value)}
                        className="w-full px-2 py-1 text-xs bg-background border border-border rounded outline-none focus:border-primary"
                      />
                      <input
                        type="text"
                        placeholder="Value"
                        value={newPropVal}
                        onChange={(e) => setNewPropVal(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleAddCustomProp();
                        }}
                        className="w-full px-2 py-1 text-xs bg-background border border-border rounded outline-none focus:border-primary"
                      />
                      <div className="flex items-center justify-end gap-1.5 pt-1">
                        <button
                          type="button"
                          onClick={() => setIsAddingProp(false)}
                          className="px-2 py-0.5 text-[10px] rounded hover:bg-secondary cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleAddCustomProp}
                          disabled={!newPropKey.trim() || !newPropVal.trim()}
                          className="px-2 py-0.5 text-[10px] rounded bg-primary text-primary-foreground disabled:opacity-50 cursor-pointer"
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={() => setIsExpanded((v) => !v)}
              className="text-[10px] font-mono opacity-60 hover:opacity-100 transition-opacity cursor-pointer"
            >
              {isExpanded ? "Hide" : "Show"}
            </button>
          </div>
        </div>

        {/* Content section */}
        {isExpanded && (
          <div className="pt-2 border-t border-border/30 space-y-2.5 text-xs">
            {/* Properties Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5">
              {/* Title */}
              {(title || (isEditable && metadata.title !== undefined)) && (
                <div className="group/field flex items-center gap-2 min-w-0 sm:col-span-2">
                  <span className="flex items-center gap-1.5 text-muted-foreground font-medium w-24 shrink-0">
                    <Heading className="w-3.5 h-3.5 text-muted-foreground/80" />
                    <span>Title</span>
                  </span>
                  {isEditable ? (
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => handleUpdateField("title", e.target.value)}
                      placeholder="Document title..."
                      className="px-2 py-0.5 rounded-md text-xs font-medium bg-secondary/80 text-secondary-foreground border border-border/40 focus:border-primary focus:bg-background outline-none flex-1 min-w-0"
                    />
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-secondary/80 text-secondary-foreground border border-border/40 truncate">
                      {title}
                    </span>
                  )}
                  {isEditable && (
                    <button
                      type="button"
                      onClick={() => handleRemoveField("title")}
                      className="opacity-0 group-hover/field:opacity-100 p-0.5 text-muted-foreground hover:text-destructive transition-all cursor-pointer"
                      title="Remove title"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              )}

              {/* Description */}
              {(desc ||
                (isEditable &&
                  (metadata.desc !== undefined || metadata.description !== undefined))) && (
                <div className="group/field flex items-start gap-2 min-w-0 sm:col-span-2">
                  <span className="flex items-center gap-1.5 text-muted-foreground font-medium w-24 shrink-0 mt-1">
                    <AlignLeft className="w-3.5 h-3.5 text-muted-foreground/80" />
                    <span>Desc</span>
                  </span>
                  {isEditable ? (
                    <textarea
                      value={desc}
                      onChange={(e) => {
                        const targetKey =
                          metadata.description !== undefined ? "description" : "desc";
                        handleUpdateField(targetKey, e.target.value);
                      }}
                      placeholder="Add a short description..."
                      rows={1}
                      className="px-2 py-0.5 rounded-md text-xs font-normal text-muted-foreground bg-secondary/80 focus:text-foreground border border-border/40 focus:border-primary focus:bg-background outline-none flex-1 min-w-0 resize-none leading-relaxed"
                    />
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-normal text-muted-foreground bg-secondary/80 border border-border/40">
                      {desc}
                    </span>
                  )}
                  {isEditable && (
                    <button
                      type="button"
                      onClick={() => {
                        handleRemoveField("desc");
                        handleRemoveField("description");
                      }}
                      className="opacity-0 group-hover/field:opacity-100 p-0.5 text-muted-foreground hover:text-destructive transition-all cursor-pointer mt-0.5"
                      title="Remove description"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              )}

              {/* Author */}
              {(author || (isEditable && metadata.author !== undefined)) && (
                <div className="group/field flex items-center gap-2 min-w-0">
                  <span className="flex items-center gap-1.5 text-muted-foreground font-medium w-24 shrink-0">
                    <User className="w-3.5 h-3.5 text-muted-foreground/80" />
                    <span>Author</span>
                  </span>
                  {isEditable ? (
                    <input
                      type="text"
                      value={author}
                      onChange={(e) => handleUpdateField("author", e.target.value)}
                      placeholder="Author name..."
                      className="px-2 py-0.5 rounded-md text-xs font-medium bg-secondary/80 text-secondary-foreground border border-border/40 focus:border-primary focus:bg-background outline-none flex-1 min-w-0 truncate"
                    />
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-secondary/80 text-secondary-foreground border border-border/40 truncate">
                      {author}
                    </span>
                  )}
                  {isEditable && (
                    <button
                      type="button"
                      onClick={() => handleRemoveField("author")}
                      className="opacity-0 group-hover/field:opacity-100 p-0.5 text-muted-foreground hover:text-destructive transition-all cursor-pointer"
                      title="Remove author"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              )}

              {/* Updated By */}
              {(updatedBy || (isEditable && metadata.updated_by !== undefined)) && (
                <div className="group/field flex items-center gap-2 min-w-0">
                  <span className="flex items-center gap-1.5 text-muted-foreground font-medium w-24 shrink-0">
                    <UserCheck className="w-3.5 h-3.5 text-muted-foreground/80" />
                    <span>Updated by</span>
                  </span>
                  {isEditable ? (
                    <input
                      type="text"
                      value={updatedBy}
                      onChange={(e) => handleUpdateField("updated_by", e.target.value)}
                      placeholder="Updated by..."
                      className="px-2 py-0.5 rounded-md text-xs font-medium bg-secondary/80 text-secondary-foreground border border-border/40 focus:border-primary focus:bg-background outline-none flex-1 min-w-0 truncate"
                    />
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-secondary/80 text-secondary-foreground border border-border/40 truncate">
                      {updatedBy}
                    </span>
                  )}
                  {isEditable && (
                    <button
                      type="button"
                      onClick={() => handleRemoveField("updated_by")}
                      className="opacity-0 group-hover/field:opacity-100 p-0.5 text-muted-foreground hover:text-destructive transition-all cursor-pointer"
                      title="Remove updated_by"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              )}

              {/* Created At (OS filesystem metadata / read-only) */}
              {createdAtDisplay && (
                <div className="flex items-center gap-2 min-w-0">
                  <span className="flex items-center gap-1.5 text-muted-foreground font-medium w-24 shrink-0">
                    <Calendar className="w-3.5 h-3.5 text-muted-foreground/80" />
                    <span>Created at</span>
                  </span>
                  <span
                    className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-mono bg-secondary/60 text-secondary-foreground border border-border/30 truncate"
                    title="Detected from file system metadata"
                  >
                    {createdAtDisplay}
                  </span>
                </div>
              )}

              {/* Updated At / Modified At (OS filesystem metadata / read-only) */}
              {updatedAtDisplay && (
                <div className="flex items-center gap-2 min-w-0">
                  <span className="flex items-center gap-1.5 text-muted-foreground font-medium w-24 shrink-0">
                    <Clock className="w-3.5 h-3.5 text-muted-foreground/80" />
                    <span>Updated at</span>
                  </span>
                  <span
                    className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-mono bg-secondary/60 text-secondary-foreground border border-border/30 truncate"
                    title="Detected from file system metadata"
                  >
                    {updatedAtDisplay}
                  </span>
                </div>
              )}

              {/* Custom Properties */}
              {customProperties.map(([key, val]) => (
                <div key={key} className="group/field flex items-center gap-2 min-w-0">
                  <span className="flex items-center gap-1.5 text-muted-foreground font-medium w-24 shrink-0 truncate capitalize">
                    <span>{key.replace(/_/g, " ")}</span>
                  </span>
                  {isEditable ? (
                    <input
                      type="text"
                      value={typeof val === "object" ? JSON.stringify(val) : String(val)}
                      onChange={(e) => handleUpdateField(key, e.target.value)}
                      className="px-2 py-0.5 rounded-md text-xs font-mono bg-secondary/50 text-secondary-foreground border border-border/30 focus:border-primary focus:bg-background outline-none flex-1 min-w-0 truncate"
                    />
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-mono bg-secondary/50 text-secondary-foreground border border-border/30 truncate">
                      {typeof val === "object" ? JSON.stringify(val) : String(val)}
                    </span>
                  )}
                  {isEditable && (
                    <button
                      type="button"
                      onClick={() => handleRemoveField(key)}
                      className="opacity-0 group-hover/field:opacity-100 p-0.5 text-muted-foreground hover:text-destructive transition-all cursor-pointer"
                      title={`Remove ${key}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Tags section */}
            {(tags.length > 0 || (isEditable && metadata.tags !== undefined)) && (
              <div className="flex items-start gap-2 min-w-0 pt-1 border-t border-border/20">
                <span className="flex items-center gap-1.5 text-muted-foreground font-medium w-24 shrink-0 mt-1">
                  <Tag className="w-3.5 h-3.5 text-muted-foreground/80" />
                  <span>Tags</span>
                </span>
                <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
                  {tags.map((tag, idx) => (
                    <span
                      key={idx}
                      className="group/tag inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-primary/10 text-primary border border-primary/20"
                    >
                      <span>#{tag}</span>
                      {isEditable && (
                        <button
                          type="button"
                          onClick={() => handleRemoveTag(tag)}
                          className="hover:text-destructive transition-colors cursor-pointer"
                          title="Remove tag"
                        >
                          <X className="w-2.5 h-2.5" />
                        </button>
                      )}
                    </span>
                  ))}

                  {isEditable && (
                    <>
                      {isAddingTag ? (
                        <div className="inline-flex items-center gap-1">
                          <input
                            type="text"
                            value={newTagInput}
                            onChange={(e) => setNewTagInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleAddTag();
                              if (e.key === "Escape") {
                                setIsAddingTag(false);
                                setNewTagInput("");
                              }
                            }}
                            placeholder="tag name..."
                            autoFocus
                            className="px-2 py-0.5 rounded-full text-[11px] bg-background border border-primary text-foreground outline-none w-24"
                          />
                          <button
                            type="button"
                            onClick={handleAddTag}
                            className="px-1.5 py-0.5 text-[10px] rounded bg-primary text-primary-foreground cursor-pointer"
                          >
                            Add
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsAddingTag(false)}
                            className="p-0.5 text-muted-foreground hover:text-foreground cursor-pointer"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setIsAddingTag(true)}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground border border-border/40 transition-colors cursor-pointer"
                        >
                          <Plus className="w-2.5 h-2.5" />
                          <span>Add tag</span>
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}

            {/* References section */}
            {(references.length > 0 || (isEditable && metadata.references !== undefined)) && (
              <div className="flex items-start gap-2 min-w-0 pt-1 border-t border-border/20">
                <span className="flex items-center gap-1.5 text-muted-foreground font-medium w-24 shrink-0 mt-1">
                  <Link2 className="w-3.5 h-3.5 text-muted-foreground/80" />
                  <span>References</span>
                </span>
                <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
                  {references.map((refPath, idx) => {
                    const isExternal =
                      refPath.startsWith("http://") || refPath.startsWith("https://");
                    const displayName = refPath.split(/[/\\]/).pop() || refPath;

                    return (
                      <div
                        key={idx}
                        className="group/ref inline-flex items-center rounded-md bg-background/80 hover:bg-primary/15 border border-border/60 hover:border-primary/40 transition-all"
                      >
                        <button
                          type="button"
                          onClick={() => handleReferenceClick(refPath)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-mono hover:text-primary transition-colors cursor-pointer select-none"
                          title={refPath}
                        >
                          {isExternal ? (
                            <ExternalLink className="w-3 h-3 text-muted-foreground group-hover/ref:text-primary" />
                          ) : (
                            <FileText className="w-3 h-3 text-muted-foreground group-hover/ref:text-primary" />
                          )}
                          <span className="truncate max-w-[220px]">{displayName}</span>
                        </button>

                        {isEditable && (
                          <button
                            type="button"
                            onClick={() => handleRemoveReference(refPath)}
                            className="p-1 pr-1.5 text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
                            title="Remove reference"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    );
                  })}

                  {/* Add Reference Popover with File Search */}
                  {isEditable && (
                    <div className="relative inline-block" ref={refPopoverRef}>
                      <button
                        type="button"
                        onClick={() => {
                          setIsAddingRef((v) => !v);
                          setRefSearchQuery("");
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-medium bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground border border-border/40 transition-colors cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Add reference</span>
                      </button>

                      {isAddingRef && (
                        <div className="absolute left-0 top-7 z-50 w-72 sm:w-80 p-2 bg-popover text-popover-foreground border border-border rounded-xl shadow-2xl space-y-2">
                          {/* Search input */}
                          <div className="relative flex items-center">
                            <Search className="w-3.5 h-3.5 absolute left-2.5 text-muted-foreground pointer-events-none" />
                            <input
                              type="text"
                              value={refSearchQuery}
                              onChange={(e) => setRefSearchQuery(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && refSearchQuery.trim()) {
                                  handleAddReferencePath(refSearchQuery);
                                }
                                if (e.key === "Escape") {
                                  setIsAddingRef(false);
                                }
                              }}
                              placeholder="Search file name or enter URL..."
                              autoFocus
                              className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-background border border-border rounded-lg outline-none focus:border-primary shadow-xs"
                            />
                          </div>

                          {/* Results list */}
                          <div className="max-h-48 overflow-y-auto space-y-0.5 pr-0.5">
                            {refSearchResults.map((result, idx) => {
                              const fileName = result.path.split(/[/\\]/).pop() || result.path;
                              const refPath = `/${result.path}`;
                              return (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() => handleAddReferencePath(refPath)}
                                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent hover:text-accent-foreground text-left text-xs transition-colors cursor-pointer group"
                                >
                                  {result.is_dir ? (
                                    <Folder className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                  ) : (
                                    <FileIcon filename={fileName} className="w-3.5 h-3.5 shrink-0" />
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <div className="font-medium text-foreground truncate group-hover:text-primary">
                                      {fileName}
                                    </div>
                                    <div className="text-[10px] text-muted-foreground truncate font-mono">
                                      {result.path}
                                    </div>
                                  </div>
                                </button>
                              );
                            })}

                            {/* Fallback option when query is typed */}
                            {refSearchQuery.trim() && (
                              <button
                                type="button"
                                onClick={() => handleAddReferencePath(refSearchQuery)}
                                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent text-left text-xs transition-colors cursor-pointer border-t border-border/30 mt-1 text-primary font-medium"
                              >
                                {refSearchQuery.startsWith("http://") ||
                                refSearchQuery.startsWith("https://") ? (
                                  <ExternalLink className="w-3.5 h-3.5 text-primary shrink-0" />
                                ) : (
                                  <Link2 className="w-3.5 h-3.5 text-primary shrink-0" />
                                )}
                                <span className="truncate">Use &quot;{refSearchQuery.trim()}&quot;</span>
                              </button>
                            )}

                            {!isSearchingFiles &&
                              refSearchResults.length === 0 &&
                              !refSearchQuery.trim() && (
                                <div className="p-3 text-center text-[11px] text-muted-foreground">
                                  Type to search files in the workspace or enter a URL
                                </div>
                              )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </NodeViewWrapper>
  );
}
