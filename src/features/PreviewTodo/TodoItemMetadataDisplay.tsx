import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { format } from "date-fns";
import { TodoItemMetadata, TodoConfig } from "./todoRenderer";

interface TodoItemMetadataDisplayProps {
  metadata?: TodoItemMetadata;
  config?: TodoConfig;
  editable: boolean;
  onMetadataChange: (field: keyof TodoItemMetadata, value: any) => void;
}

export function DueDateDisplay({
  due,
  editable,
  onUpdate
}: {
  due: string,
  editable: boolean,
  onUpdate: (date: string) => void
}) {
  const [open, setOpen] = useState(false);

  const formatDueDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return format(date, 'd MMM');
    } catch {
      return dateStr;
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          disabled={!editable}
          className="inline-flex items-center text-[10px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer group/badge relative text-left disabled:cursor-not-allowed disabled:opacity-70"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="mr-1">{formatDueDate(due)}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={new Date(due)}
          onSelect={(date) => {
            if (date) {
              onUpdate(date.toISOString().split('T')[0]);
            }
            setOpen(false);
          }}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}

export function AssigneeDisplay({
  assignee,
  config
}: {
  assignee: string,
  config?: TodoConfig
}) {
  const assigneeInfo = config?.assignees?.find(a => a.alias === assignee);

  if (!assigneeInfo) return null;

  return (
    <div className="group/badge relative shrink-0">
      <Avatar className="h-6 w-6 border border-border">
        <AvatarImage src={assigneeInfo.avatar} alt={assigneeInfo.name} />
        <AvatarFallback className="text-[10px]">
          {assigneeInfo.name.substring(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>
    </div>
  );
}

export function PriorityDisplay({
  priority,
  config
}: {
  priority: 'high' | 'medium' | 'low',
  config?: TodoConfig
}) {
  return (
    <div
      className="inline-flex items-center rounded-md px-1 py-0.5 text-[9px] font-bold uppercase transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
      style={{
        // backgroundColor: (config?.priorities?.[priority]?.color || '#6b7280'),
        color: config?.priorities?.[priority]?.color || '#6b7280',
        // borderColor: (config?.priorities?.[priority]?.color || '#6b7280') + '30'
      }}
    >
      {priority}
    </div>
  );
}

export function TodoItemMetadataDisplay({
  metadata,
  config,
  editable,
  onMetadataChange,
}: TodoItemMetadataDisplayProps) {
  if (!metadata) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {metadata.due && (
        <DueDateDisplay
          due={metadata.due}
          editable={editable}
          onUpdate={(val) => onMetadataChange("due", val)}
        />
      )}

      {metadata.priority && (
        <PriorityDisplay
          priority={metadata.priority}
          config={config}
        />
      )}

      {metadata.assignee && (
        <AssigneeDisplay
          assignee={metadata.assignee}
          config={config}
        />
      )}
    </div>
  );
}
