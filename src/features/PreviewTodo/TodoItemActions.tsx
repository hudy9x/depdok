import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MoreHorizontal, Calendar as CalendarIcon, User, Flag, Trash2 } from "lucide-react";
import { TodoItemMetadata, TodoConfig } from "./todoRenderer";

interface TodoItemActionsProps {
  metadata?: TodoItemMetadata;
  config?: TodoConfig;
  onMetadataChange: (field: keyof TodoItemMetadata, value: any) => void;
  onRemoveMetadata: (field: keyof TodoItemMetadata) => void;
  onDelete?: () => void;
}

export function TodoItemActions({
  metadata,
  config,
  onMetadataChange,
  onRemoveMetadata,
  onDelete,
}: TodoItemActionsProps) {
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 inline-flex items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground"
        >
          <MoreHorizontal className="h-3 w-3" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-xs">Edit Metadata</DropdownMenuLabel>
        <DropdownMenuSeparator />

        {/* Assignee submenu */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="text-xs">
            <User className="mr-2 h-3 w-3" />
            <span>Assignee</span>
            {metadata?.assignee && (
              <span className="ml-auto text-[10px] text-muted-foreground">{metadata.assignee}</span>
            )}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem
              className="text-xs"
              onClick={() => onMetadataChange("assignee", undefined)}
            >
              None
            </DropdownMenuItem>
            {config?.assignees?.map((assignee) => (
              <DropdownMenuItem
                key={assignee.alias}
                className="text-xs"
                onClick={() => onMetadataChange("assignee", assignee.alias)}
              >
                <Avatar className="h-4 w-4 mr-2">
                  <AvatarImage src={assignee.avatar} alt={assignee.name} />
                  <AvatarFallback className="text-[8px]">
                    {assignee.name.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                {assignee.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        {/* Priority submenu */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="text-xs">
            <Flag className="mr-2 h-3 w-3" />
            <span>Priority</span>
            {metadata?.priority && (
              <span className="ml-auto text-[10px] text-muted-foreground capitalize">{metadata.priority}</span>
            )}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem
              className="text-xs"
              onClick={() => onMetadataChange("priority", undefined)}
            >
              <Flag className="mr-2 h-3 w-3 text-muted-foreground" />
              None
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-xs"
              onClick={() => onMetadataChange("priority", "high")}
            >
              <Flag
                className="mr-2 h-3 w-3"
                style={{ color: config?.priorities?.high?.color || '#ef4444' }}
                fill={config?.priorities?.high?.color || '#ef4444'}
              />
              High
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-xs"
              onClick={() => onMetadataChange("priority", "medium")}
            >
              <Flag
                className="mr-2 h-3 w-3"
                style={{ color: config?.priorities?.medium?.color || '#f59e0b' }}
                fill={config?.priorities?.medium?.color || '#f59e0b'}
              />
              Medium
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-xs"
              onClick={() => onMetadataChange("priority", "low")}
            >
              <Flag
                className="mr-2 h-3 w-3"
                style={{ color: config?.priorities?.low?.color || '#10b981' }}
                fill={config?.priorities?.low?.color || '#10b981'}
              />
              Low
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSeparator />

        {/* Date picker with Popover */}
        <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
          <PopoverTrigger asChild>
            <button className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-xs outline-none transition-colors hover:bg-accent hover:text-accent-foreground w-full">
              <CalendarIcon className="mr-2 h-3 w-3" />
              <span>Due Date</span>
              {metadata?.due && (
                <span className="ml-auto text-[10px] text-muted-foreground">{metadata.due}</span>
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={metadata?.due ? new Date(metadata.due + 'T00:00:00') : undefined}
              onSelect={(date) => {
                if (date) {
                  // Use date-fns format to avoid timezone issues
                  const year = date.getFullYear();
                  const month = String(date.getMonth() + 1).padStart(2, '0');
                  const day = String(date.getDate()).padStart(2, '0');
                  onMetadataChange("due", `${year}-${month}-${day}`);
                } else {
                  onRemoveMetadata("due");
                }
                setDatePickerOpen(false);
              }}
            />
          </PopoverContent>
        </Popover>

        {/* Delete action */}
        {onDelete && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-xs text-destructive focus:text-destructive"
              onClick={onDelete}
            >
              <Trash2 className="!mr-2 !h-3 !w-3 text-destructive" />
              Delete
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
