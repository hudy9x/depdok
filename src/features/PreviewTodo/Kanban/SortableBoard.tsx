import { useState } from "react";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { GripVertical, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

import { LiveSection } from "./dndTypes";
import { TodoConfig } from "../todoRenderer";
import { DraggableTodoItem } from "../DraggableTodoItem";
import { KanbanCreateTaskButton } from "./KanbanCreateTaskButton";
import { ColorSelector } from "../ColorSelector";

export interface SortableBoardProps {
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
  onAddItem: (si: number, metadata?: any, title?: string) => void;
}

export function SortableBoard({
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
        <CardHeader className="px-4 -ml-0.5 flex flex-row items-center justify-between space-y-0 group">
          {editable && (
            <button
              ref={setActivatorNodeRef}
              {...attributes}
              {...listeners}
              className="flex-shrink-0 flex items-center justify-center w-5 h-6 mr-1 rounded text-muted-foreground/40 hover:text-muted-foreground opacity-100 transition-opacity cursor-grabbing focus:outline-none"
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
                <span className="text-muted-foreground text-xs px-2 py-0.5 bg-accent rounded-md font-normal">
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
              <KanbanCreateTaskButton
                onCreateTask={(title) => onAddItem(docSectionIndex, undefined, title)}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
