import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { TodoItem as TodoItemType, TodoConfig } from "./todoRenderer";

interface TodoItemProps {
  item: TodoItemType;
  sectionIndex: number;
  itemIndex: number;
  config?: TodoConfig;
  editable: boolean;
  onToggle: (sectionIndex: number, itemIndex: number) => void;
  onUpdateTitle: (sectionIndex: number, itemIndex: number, newTitle: string) => void;
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
  onRemove,
}: TodoItemProps) {
  return (
    <div className="group relative  flex flex-col gap-1 p-2 shadow-sm rounded-md border-0 border-border bg-card hover:shadow-lg transition-all">
      <div className="flex relative items-start gap-2">
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
            "flex-1 h-auto p-0 border-0 bg-transparent shadow-none focus-visible:ring-0 px-1 min-h-[1.5rem]",
            item.checked && "line-through text-muted-foreground"
          )}
          disabled={!editable}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.currentTarget.blur();
            }
          }}
        />
        {editable && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
            onClick={() => onRemove(sectionIndex, itemIndex)}
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>

      {/* Metadata badges */}
      {item.metadata && (item.metadata.assignee || item.metadata.priority || item.metadata.due) && (
        <div className="flex gap-1.5 ml-7 flex-wrap">
          {item.metadata.due && (
            <Badge variant="outline" className="text-[10px] bg-secondary text-secondary-foreground h-5 px-1.5">
              📅 {item.metadata.due}
            </Badge>
          )}
          {item.metadata.assignee && (
            <Badge variant="outline" className="text-[10px] bg-secondary text-secondary-foreground h-5 px-1.5">
              {item.metadata.assignee}
            </Badge>
          )}
          {item.metadata.priority && (
            <div
              className="absolute z-[5] -top-[10px] right-2 rounded-t text-[7px] uppercase h-[10px] px-1.5"
              style={{
                backgroundColor: config?.priorities?.[item.metadata.priority]?.color || '#6b7280',
                color: 'white'
              }}
            >
              {item.metadata.priority}
            </div>
          )}

        </div>
      )}
    </div>
  );
}
