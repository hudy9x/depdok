import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { TodoItem } from "./TodoItem";
import { TodoItem as TodoItemType, TodoConfig, TodoItemMetadata } from "./todoRenderer";

interface DraggableTodoItemProps {
  id: string;
  item: TodoItemType;
  sectionIndex: number;
  itemIndex: number;
  config?: TodoConfig;
  editable: boolean;
  onToggle: (sectionIndex: number, itemIndex: number) => void;
  onUpdateTitle: (sectionIndex: number, itemIndex: number, newTitle: string) => void;
  onUpdateMetadata: (sectionIndex: number, itemIndex: number, metadata: TodoItemMetadata) => void;
  onRemove: (sectionIndex: number, itemIndex: number) => void;
}

export function DraggableTodoItem({
  id,
  item,
  sectionIndex,
  itemIndex,
  config,
  editable,
  onToggle,
  onUpdateTitle,
  onUpdateMetadata,
  onRemove,
}: DraggableTodoItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="relative group/item"
    >
      {/* Invisible placeholder while dragging */}
      {isDragging && (
        <div className="absolute inset-0 rounded-lg border-2 border-dashed border-primary/40 bg-primary/5 z-10" />
      )}

      {/* Drag handle — absolute left, visible on hover */}
      {editable && (
        <button
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          className={`
            absolute -left-5 top-1/2 -translate-y-1/2 z-20
            flex items-center justify-center
            w-4 h-6 rounded
            text-muted-foreground/40 hover:text-muted-foreground
            opacity-0 group-hover/item:opacity-100
            transition-opacity cursor-grab active:cursor-grabbing
            focus:outline-none
          `}
          tabIndex={-1}
          aria-label="Drag to reorder"
        >
          <GripVertical className="w-3.5 h-3.5" />
        </button>
      )}

      <div className={isDragging ? "opacity-30" : ""}>
        <TodoItem
          item={item}
          sectionIndex={sectionIndex}
          itemIndex={itemIndex}
          config={config}
          editable={editable}
          onToggle={onToggle}
          onUpdateTitle={onUpdateTitle}
          onUpdateMetadata={onUpdateMetadata}
          onRemove={onRemove}
        />
      </div>
    </div>
  );
}
