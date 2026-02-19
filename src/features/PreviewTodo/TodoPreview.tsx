import { useState, useCallback } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useTodoDocument } from "./useTodoDocument";
import { TodoItem } from "./TodoItem";
import { DraggableTodoItem } from "./DraggableTodoItem";
import { ColorSelector } from "./ColorSelector";
import { WeekView } from "./Week/WeekView";
import { ViewModeSwitcher } from "./ViewModeSwitcher";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { GripVertical, Plus, Trash2, MoreHorizontal, Pencil } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { TodoSection, TodoItem as TodoItemType, TodoConfig } from "./todoRenderer";

interface TodoPreviewProps {
  content: string;
  onContentChange?: (content: string) => void;
  editable?: boolean;
}

// ─── Live types ───────────────────────────────────────────────────────────────
// Each live section/item carries:
//   _id        — unique dnd ID for this drag session
//   _origIdx   — index in the ORIGINAL sortedSections (sections) or items array
//                so we can always map back to document.sections on drop

interface LiveItem extends TodoItemType {
  _id: string;
  _origSectionIdx: number; // original section index in sortedSections
  _origItemIdx: number;    // original item index in that section
}

interface LiveSection extends Omit<TodoSection, "items"> {
  _id: string;
  _origIdx: number; // original index in sortedSections
  _docIdx: number;  // original index in document.sections
  items: LiveItem[];
}

// ─── Deterministic IDs ────────────────────────────────────────────────────────
// Use index-based IDs to ensure the static render matches the drag start state.
const getBoardId = (idx: number) => `board-${idx}`;
const getItemId = (sIdx: number, iIdx: number) => `item-${sIdx}-${iIdx}`;

function buildLiveSections(sortedSections: TodoSection[], documentSections: TodoSection[]): LiveSection[] {
  return sortedSections.map((section, si) => ({
    ...section,
    _id: getBoardId(si),
    _origIdx: si,
    _docIdx: documentSections.indexOf(section),
    items: section.items.map((item, ii) => ({
      ...item,
      _id: getItemId(si, ii),
      _origSectionIdx: si,
      _origItemIdx: ii,
    })),
  }));
}

// ─── Sortable Board ───────────────────────────────────────────────────────────

interface SortableBoardProps {
  section: LiveSection;
  docSectionIndex: number;
  config?: TodoConfig;
  editable: boolean;
  onSectionTitleChange: (idx: number, title: string) => void;
  onSectionColorChange: (idx: number, color: string | undefined) => void;
  onRemoveSection: (idx: number) => void;
  onToggleItem: (si: number, ii: number) => void;
  onUpdateItemTitle: (si: number, ii: number, title: string) => void;
  onUpdateItemMetadata: (si: number, ii: number, metadata: any) => void;
  onRemoveItem: (si: number, ii: number) => void;
  onAddItem: (si: number) => void;
}

function SortableBoard({
  section,
  docSectionIndex,
  config,
  editable,
  onSectionTitleChange,
  onSectionColorChange,
  onRemoveSection,
  onToggleItem,
  onUpdateItemTitle,
  onUpdateItemMetadata,
  onRemoveItem,
  onAddItem,
}: SortableBoardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section._id });

  const [isEditingTitle, setIsEditingTitle] = useState(false);


  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className="flex-shrink-0 w-80"
    >
      <Card
        className={`pb-0 pt-4 shadow-none border-dashed rounded-sm flex flex-col gap-2 max-h-full ${isDragging ? "opacity-40" : ""}`}
      >
        <CardHeader className="px-4 flex flex-row items-center justify-between space-y-0 group">
          {editable && (
            <button
              ref={setActivatorNodeRef}
              {...attributes}
              {...listeners}
              className="flex-shrink-0 flex items-center justify-center w-5 h-6 mr-1 rounded text-muted-foreground/40 hover:text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing focus:outline-none"
              tabIndex={-1}
              aria-label="Drag to reorder board"
            >
              <GripVertical className="w-4 h-4" />
            </button>
          )}
          <ColorSelector
            currentColor={section.metadata?.bg}
            onColorChange={(color) => onSectionColorChange(docSectionIndex, color)}
            editable={editable}
          />

          <div className="flex-1 min-w-0 flex items-center gap-2 group/title">
            {isEditingTitle && editable ? (
              <Input
                value={section.title}
                onChange={(e) => onSectionTitleChange(docSectionIndex, e.target.value)}
                autoFocus
                onBlur={() => setIsEditingTitle(false)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") setIsEditingTitle(false);
                  if (e.key === "Escape") setIsEditingTitle(false);
                }}
                className="font-semibold text-lg bg-background shadow-sm h-8 py-1 px-2"
              />
            ) : (
              <div
                className="flex items-center gap-2 font-semibold text-lg px-1 py-0.5 cursor-default truncate"
                onDoubleClick={() => editable && setIsEditingTitle(true)}
              >
                <span className="truncate">{section.title}</span>
                <span className="text-muted-foreground text-sm font-normal">
                  {section.items.length}
                </span>

              </div>
            )}
          </div>

          {editable && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground data-[state=open]:opacity-100"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </div>

              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setIsEditingTitle(true)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => onRemoveSection(docSectionIndex)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </CardHeader>

        <CardContent className="px-2 pb-2 flex-1 overflow-hidden h-full flex flex-col gap-2">
          <ScrollArea className="flex-1 max-h-[calc(100vh-48px)]">
            <SortableContext items={section.items.map(it => it._id)} strategy={verticalListSortingStrategy}>
              <div className="flex flex-col gap-3 pt-1 pl-5 pr-1">
                {section.items.map((item, itemIndex) => (
                  <DraggableTodoItem
                    key={item._id}
                    id={item._id}
                    item={item}
                    sectionIndex={docSectionIndex}
                    itemIndex={itemIndex}
                    config={config}
                    editable={editable}
                    onToggle={onToggleItem}
                    onUpdateTitle={onUpdateItemTitle}
                    onUpdateMetadata={onUpdateItemMetadata}
                    onRemove={onRemoveItem}
                  />
                ))}
              </div>
            </SortableContext>
          </ScrollArea>
          {editable && (
            <div className="pl-5 pr-1">
              <Button
                variant="ghost"
                className="w-full justify-start mt-1 hover:bg-transparent text-muted-foreground"
                onClick={() => onAddItem(docSectionIndex)}
              >
                <Plus className="h-4 w-4" /> Add Item
              </Button>
            </div>

          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function TodoPreview({ content, onContentChange, editable = false }: TodoPreviewProps) {
  // ... state ...
  const [newSectionTitle, setNewSectionTitle] = useState("");
  const [isAddingSection, setIsAddingSection] = useState(false);

  const [liveSections, setLiveSections] = useState<LiveSection[] | null>(null);
  const [activeBoardId, setActiveBoardId] = useState<string | null>(null);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);

  const {
    document,
    handleToggleItem,
    handleUpdateItemTitle,
    handleUpdateItemMetadata,
    handleAddItem,
    handleRemoveItem,
    handleAddSection,
    handleRemoveSection,
    handleSectionTitleChange,
    handleSectionColorChange,
    handleModeChange,
    handleSetSectionsOrder,
    handleMoveItem,
  } = useTodoDocument({ content, editable, onContentChange });

  const currentMode = document.config?.mode || "kanban";

  // ... sortedSections ...
  const sortedSections = [...document.sections].sort((a, b) => {
    const orderA = a.metadata?.order ?? 999;
    const orderB = b.metadata?.order ?? 999;
    return orderA - orderB;
  });

  // ... sensors ...
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // ── Drag start ──────────────────────────────────────────────────────────────
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const id = String(event.active.id);
    const live = buildLiveSections(sortedSections, document.sections);
    setLiveSections(live);

    if (live.some(s => s._id === id)) {
      setActiveBoardId(id);
    } else {
      setActiveItemId(id);
    }
  }, [sortedSections, document.sections]);

  // ... handleDragOver (no change needed in logic, just re-use) ...
  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event;
    if (!over || !liveSections) return;

    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId === overId) return;

    // Board reorder
    if (activeBoardId) {
      const ai = liveSections.findIndex(s => s._id === activeId);

      // If overId is a board, use it directly
      let oi = liveSections.findIndex(s => s._id === overId);

      // If overId is NOT a board, check if it's an item inside a board
      if (oi === -1) {
        oi = liveSections.findIndex(s => s.items.some(i => i._id === overId));
      }

      if (ai === -1 || oi === -1 || ai === oi) return;
      setLiveSections(arrayMove(liveSections, ai, oi));
      return;
    }

    // Item move
    if (activeItemId) {
      // Find source
      let srcSi = -1, srcIi = -1;
      for (let si = 0; si < liveSections.length; si++) {
        const ii = liveSections[si].items.findIndex(it => it._id === activeId);
        if (ii !== -1) { srcSi = si; srcIi = ii; break; }
      }
      if (srcSi === -1) return;

      // Find target
      let tgtSi = -1, tgtIi = -1;
      const overBoardIdx = liveSections.findIndex(s => s._id === overId);
      if (overBoardIdx !== -1) {
        tgtSi = overBoardIdx;
        tgtIi = liveSections[overBoardIdx].items.length;
      } else {
        for (let si = 0; si < liveSections.length; si++) {
          const ii = liveSections[si].items.findIndex(it => it._id === overId);
          if (ii !== -1) { tgtSi = si; tgtIi = ii; break; }
        }
      }
      if (tgtSi === -1) return;
      if (srcSi === tgtSi && srcIi === tgtIi) return;

      const next = liveSections.map(s => ({ ...s, items: [...s.items] }));
      const [moved] = next[srcSi].items.splice(srcIi, 1);

      // Adjust index when moving down within same section
      if (tgtSi === srcSi && tgtIi > srcIi) tgtIi--;

      next[tgtSi].items.splice(Math.min(tgtIi, next[tgtSi].items.length), 0, moved);
      setLiveSections(next);
    }
  }, [activeBoardId, activeItemId, liveSections]);

  // ── Drag end — commit live state ────────────────────────────────────────────
  const handleDragEnd = useCallback((_event: DragEndEvent) => {
    if (!liveSections) { reset(); return; }

    if (activeBoardId) {
      // Reconstruct the full ordered list of sections
      // We map the liveSections (which are in the desired order) back to the original objects
      // using the _docIdx we stored.
      const newOrderedSections = liveSections.map(ls => document.sections[ls._docIdx]);
      handleSetSectionsOrder(newOrderedSections);
    }

    if (activeItemId) {
      // Find where the active item ended up
      let finalSi = -1, finalIi = -1;
      for (let si = 0; si < liveSections.length; si++) {
        const ii = liveSections[si].items.findIndex(it => it._id === activeItemId);
        if (ii !== -1) { finalSi = si; finalIi = ii; break; }
      }
      if (finalSi !== -1) {
        const liveItem = liveSections[finalSi].items[finalIi];
        const origSortedSectionIdx = liveItem._origSectionIdx;
        const origItemIdx = liveItem._origItemIdx;
        const finalSortedSectionIdx = liveSections[finalSi]._origIdx;

        // Map sortedSections indices → document.sections indices
        const origDocSi = document.sections.indexOf(sortedSections[origSortedSectionIdx]);
        const finalDocSi = document.sections.indexOf(sortedSections[finalSortedSectionIdx]);

        if (origDocSi !== -1 && finalDocSi !== -1) {
          handleMoveItem(origDocSi, origItemIdx, finalDocSi, finalIi);
        }
      }
    }

    reset();
  }, [activeBoardId, activeItemId, liveSections, sortedSections, document.sections, handleSetSectionsOrder, handleMoveItem]);

  const reset = () => {
    setActiveBoardId(null);
    setActiveItemId(null);
    setLiveSections(null);
  };

  const handleDragCancel = useCallback(() => reset(), []);

  // ── Overlay data ─────────────────────────────────────────────────────────────
  const activeBoardSection = activeBoardId && liveSections
    ? liveSections.find(s => s._id === activeBoardId) ?? null
    : null;

  let activeItem: LiveItem | null = null;
  if (activeItemId && liveSections) {
    for (const s of liveSections) {
      const found = s.items.find(it => it._id === activeItemId);
      if (found) { activeItem = found; break; }
    }
  }

  // ── Sections to render ───────────────────────────────────────────────────────
  // During drag: use liveSections. Otherwise: build static live-shaped sections.
  // During drag: use liveSections. Otherwise: build static live-shaped sections.
  const sectionsToRender: LiveSection[] = liveSections ?? sortedSections.map((s, si) => ({
    ...s,
    _id: getBoardId(si),
    _origIdx: si,
    _docIdx: document.sections.indexOf(s),
    items: s.items.map((item, ii) => ({
      ...item,
      _id: getItemId(si, ii),
      _origSectionIdx: si,
      _origItemIdx: ii,
    })),
  }));

  const handleAddSectionClick = () => {
    if (!newSectionTitle.trim()) return;
    handleAddSection(newSectionTitle);
    setNewSectionTitle("");
    setIsAddingSection(false);
  };

  return (
    <>
      {currentMode === "week" ? (
        <WeekView
          document={document}
          editable={editable}
          onToggleItem={handleToggleItem}
          onUpdateItemTitle={handleUpdateItemTitle}
          onUpdateItemMetadata={handleUpdateItemMetadata}
          onRemoveItem={handleRemoveItem}
          onAddItem={handleAddItem}
        />
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <div className="h-full w-full overflow-x-auto p-2 bg-background">
            <SortableContext
              items={sectionsToRender.map(s => s._id)}
              strategy={horizontalListSortingStrategy}
            >
              <div className="flex h-full gap-4 items-start">
                {sectionsToRender.map((section) => {
                  // docSectionIndex: index in document.sections for callbacks
                  const docSectionIndex = document.sections.indexOf(sortedSections[section._origIdx]);
                  return (
                    <SortableBoard
                      key={section._id}
                      section={section}
                      docSectionIndex={docSectionIndex}
                      config={document.config}
                      editable={editable}
                      onSectionTitleChange={handleSectionTitleChange}
                      onSectionColorChange={handleSectionColorChange}
                      onRemoveSection={handleRemoveSection}
                      onToggleItem={handleToggleItem}
                      onUpdateItemTitle={handleUpdateItemTitle}
                      onUpdateItemMetadata={handleUpdateItemMetadata}
                      onRemoveItem={handleRemoveItem}
                      onAddItem={handleAddItem}
                    />
                  );
                })}

                {editable && (
                  <div className="w-80 flex-shrink-0">
                    {isAddingSection ? (
                      <Card className="bg-card/50">
                        <CardContent className="p-3 space-y-2">
                          <Input
                            placeholder="New Section Title"
                            value={newSectionTitle}
                            onChange={(e) => setNewSectionTitle(e.target.value)}
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleAddSectionClick();
                              if (e.key === "Escape") setIsAddingSection(false);
                            }}
                          />
                          <div className="flex gap-2 justify-end">
                            <Button variant="ghost" size="sm" onClick={() => setIsAddingSection(false)}>
                              Cancel
                            </Button>
                            <Button size="sm" onClick={handleAddSectionClick}>
                              Add Section
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ) : (
                      <Button
                        variant="outline"
                        className="w-full h-auto mt-3 py-2 border-dashed"
                        onClick={() => setIsAddingSection(true)}
                      >
                        <Plus className="mr-2 h-4 w-4" /> Add Section
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </SortableContext>
          </div>

          {/* Drag Overlay */}
          <DragOverlay dropAnimation={null}>
            {activeBoardSection && (
              <Card className="w-80 pb-0 pt-4 shadow-xl border-dashed rounded-sm opacity-90 border-primary rotate-1">
                <CardHeader className="px-4 flex flex-row items-center gap-2 space-y-0">
                  <GripVertical className="w-4 h-4 text-muted-foreground" />
                  <span className="font-semibold text-lg">{activeBoardSection.title}</span>
                </CardHeader>
                <CardContent className="px-4 pb-4 text-sm text-muted-foreground">
                  {activeBoardSection.items.length} item{activeBoardSection.items.length !== 1 ? "s" : ""}
                </CardContent>
              </Card>
            )}
            {activeItem && (
              <div className="w-72 rotate-1 shadow-xl opacity-95">
                <TodoItem
                  item={activeItem}
                  sectionIndex={0}
                  itemIndex={0}
                  config={document.config}
                  editable={false}
                  onToggle={() => { }}
                  onUpdateTitle={() => { }}
                  onUpdateMetadata={() => { }}
                  onRemove={() => { }}
                />
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}

      <ViewModeSwitcher
        mode={currentMode}
        onModeChange={handleModeChange}
        editable={editable}
      />
    </>
  );
}
