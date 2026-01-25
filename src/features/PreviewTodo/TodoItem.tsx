import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { TodoItem as TodoItemType, TodoConfig, TodoItemMetadata } from "./todoRenderer";
import { TodoItemActions } from "./TodoItemActions";
import { TodoItemMetadataDisplay } from "./TodoItemMetadataDisplay";

interface TodoItemProps {
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

export function TodoItem({
  item,
  sectionIndex,
  itemIndex,
  config,
  editable,
  onToggle,
  onUpdateTitle,
  onUpdateMetadata,
  onRemove,
}: TodoItemProps) {
  const handleMetadataChange = (field: keyof TodoItemMetadata, value: any) => {
    const newMetadata = { ...item.metadata, [field]: value };
    onUpdateMetadata(sectionIndex, itemIndex, newMetadata);
  };

  const handleRemoveMetadata = (field: keyof TodoItemMetadata) => {
    const newMetadata = { ...item.metadata };
    delete newMetadata[field];
    onUpdateMetadata(sectionIndex, itemIndex, newMetadata);
  };

  return (
    <div className={`group relative flex flex-col gap-1 p-2 shadow-xs rounded-lg border border-border bg-card hover:shadow-lg hover:opacity-90 transition-all ${item.checked && "opacity-60"}`}>
      <div className="flex relative items-start gap-2 px-1">
        <Checkbox
          checked={item.checked}
          onCheckedChange={() => onToggle(sectionIndex, itemIndex)}
          disabled={!editable}
          className="mt-1"
        />
        <Input
          value={item.title}
          onChange={(e) => onUpdateTitle(sectionIndex, itemIndex, e.target.value)}
          className={cn(
            "flex-1 h-auto p-0 border-0 bg-transparent shadow-none focus-visible:ring-0 px-1 min-h-[1.5rem] text-sm",
            item.checked && "line-through text-muted-foreground"
          )}
          style={{ backgroundColor: "transparent" }}
          disabled={!editable}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.currentTarget.blur();
            }
          }}
        />
        {editable && (
          <>
            {/* Three-dot metadata menu */}
            <TodoItemActions
              metadata={item.metadata}
              config={config}
              onMetadataChange={handleMetadataChange}
              onRemoveMetadata={handleRemoveMetadata}
            />

            {/* Delete button */}
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
              onClick={() => onRemove(sectionIndex, itemIndex)}
            >
              <X className="h-3 w-3" />
            </Button>
          </>
        )}
      </div>

      {/* Metadata display */}
      <TodoItemMetadataDisplay
        metadata={item.metadata}
        config={config}
        editable={editable}
        onMetadataChange={handleMetadataChange}
        onRemoveMetadata={handleRemoveMetadata}
      />
    </div>
  );
}
