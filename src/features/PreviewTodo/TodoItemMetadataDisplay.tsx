import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CalendarIcon, X } from "lucide-react";
import { format } from "date-fns";
import { TodoItemMetadata, TodoConfig } from "./todoRenderer";

interface TodoItemMetadataDisplayProps {
  metadata?: TodoItemMetadata;
  config?: TodoConfig;
  editable: boolean;
  onMetadataChange: (field: keyof TodoItemMetadata, value: any) => void;
  onRemoveMetadata: (field: keyof TodoItemMetadata) => void;
}

export function TodoItemMetadataDisplay({
  metadata,
  config,
  editable,
  onMetadataChange,
  onRemoveMetadata,
}: TodoItemMetadataDisplayProps) {
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  if (!metadata || (!metadata.assignee && !metadata.priority && !metadata.due)) {
    return null;
  }

  const formatDueDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return format(date, 'MMM dd');
    } catch {
      return dateStr;
    }
  };

  const getAssigneeInfo = (alias: string) => {
    return config?.assignees?.find(a => a.alias === alias);
  };

  const assigneeInfo = metadata.assignee ? getAssigneeInfo(metadata.assignee) : undefined;

  return (
    <div className="flex gap-1.5 ml-8 flex-wrap items-center">
      {/* Due date badge with date picker */}
      {metadata.due && (
        <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
          <PopoverTrigger asChild>
            <button
              className="inline-flex items-center justify-center text-[10px] h-5 bg-transparent text-muted-foreground cursor-pointer group/badge relative pr-5"
            >
              <CalendarIcon className="h-3 w-3 mr-1 text-muted-foreground" /> {formatDueDate(metadata.due)}
              {editable && (
                <span
                  className="absolute right-0.5 opacity-0 group-hover/badge:opacity-100 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveMetadata("due");
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
              selected={new Date(metadata.due)}
              onSelect={(date) => {
                if (date) {
                  onMetadataChange("due", date.toISOString().split('T')[0]);
                }
                setDatePickerOpen(false);
              }}
            />
          </PopoverContent>
        </Popover>
      )}

      {/* Assignee avatar */}
      {metadata.assignee && assigneeInfo && (
        <div className="group/badge relative">
          <Avatar className="h-5 w-5 cursor-pointer border border-border">
            <AvatarImage src={assigneeInfo.avatar} alt={assigneeInfo.name} />
            <AvatarFallback className="text-[8px]">
              {assigneeInfo.name.substring(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          {editable && (
            <button
              className="absolute -right-1 -top-1 opacity-0 group-hover/badge:opacity-100 transition-opacity bg-destructive rounded-full p-0.5"
              onClick={() => onRemoveMetadata("assignee")}
            >
              <X className="h-2 w-2 text-white" />
            </button>
          )}
        </div>
      )}

      {/* Priority badge (top-right corner) */}
      {metadata.priority && (
        <div
          className="absolute z-[5] -top-[10px] right-2 rounded-t text-[7px] uppercase h-[10px] px-1.5 group/priority"
          style={{
            backgroundColor: config?.priorities?.[metadata.priority]?.color || '#6b7280',
            color: 'white'
          }}
        >
          {metadata.priority}
          {editable && (
            <button
              className="absolute -right-1 -top-0.5 opacity-0 group-hover/priority:opacity-100 transition-opacity bg-destructive rounded-full p-0.5"
              onClick={() => onRemoveMetadata("priority")}
            >
              <X className="h-2 w-2 text-white" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
