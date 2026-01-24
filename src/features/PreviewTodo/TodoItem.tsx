import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { TodoItem as TodoItemType, TodoConfig, TodoItemMetadata } from "./todoRenderer";
import { TodoItemActions } from "./TodoItemActions";

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
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  const handleMetadataChange = (field: keyof TodoItemMetadata, value: any) => {
    const newMetadata = { ...item.metadata, [field]: value };
    onUpdateMetadata(sectionIndex, itemIndex, newMetadata);
  };

  const handleRemoveMetadata = (field: keyof TodoItemMetadata) => {
    const newMetadata = { ...item.metadata };
    delete newMetadata[field];
    onUpdateMetadata(sectionIndex, itemIndex, newMetadata);
  };

  const formatDueDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return formatDistanceToNow(date, { addSuffix: true });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="group relative flex flex-col gap-1 p-2 shadow-xs rounded-lg border border-border bg-card hover:shadow-lg transition-all">
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

      {/* Metadata badges */}
      {item.metadata && (item.metadata.assignee || item.metadata.priority || item.metadata.due) && (
        <div className="flex gap-1.5 ml-7 flex-wrap">
          {/* Due date badge with date picker */}
          {item.metadata.due && (
            <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
              <PopoverTrigger asChild>
                <button
                  className="inline-flex items-center justify-center rounded-md border border-border px-1.5 text-[10px] h-5 bg-secondary text-secondary-foreground cursor-pointer hover:bg-secondary/80 group/badge relative pr-5"
                >
                  <CalendarIcon className="h-3 w-3 mr-1 text-muted-foreground" /> {formatDueDate(item.metadata.due)}
                  {editable && (
                    <span
                      className="absolute right-0.5 opacity-0 group-hover/badge:opacity-100 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveMetadata("due");
                      }}
                    >
                      <X className="h-2.5 w-2.5" />
                    </span>
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={new Date(item.metadata.due)}
                  onSelect={(date) => {
                    if (date) {
                      handleMetadataChange("due", date.toISOString().split('T')[0]);
                    }
                    setDatePickerOpen(false);
                  }}
                />
              </PopoverContent>
            </Popover>
          )}

          {/* Assignee badge */}
          {item.metadata.assignee && (
            <div className="inline-flex items-center justify-center rounded-md border border-border px-1.5 text-[10px] h-5 bg-secondary text-secondary-foreground group/badge relative pr-5">
              {item.metadata.assignee}
              {editable && (
                <button
                  className="absolute right-0.5 opacity-0 group-hover/badge:opacity-100 transition-opacity"
                  onClick={() => handleRemoveMetadata("assignee")}
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              )}
            </div>
          )}

          {/* Priority badge (top-right corner) */}
          {item.metadata.priority && (
            <div
              className="absolute z-[5] -top-[10px] right-2 rounded-t text-[7px] uppercase h-[10px] px-1.5 group/priority"
              style={{
                backgroundColor: config?.priorities?.[item.metadata.priority]?.color || '#6b7280',
                color: 'white'
              }}
            >
              {item.metadata.priority}
              {editable && (
                <button
                  className="absolute -right-1 -top-0.5 opacity-0 group-hover/priority:opacity-100 transition-opacity bg-destructive rounded-full p-0.5"
                  onClick={() => handleRemoveMetadata("priority")}
                >
                  <X className="h-2 w-2 text-white" />
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
