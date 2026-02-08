import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { TodoItem, TodoConfig, TodoItemMetadata } from "../todoRenderer";
import { TodoItemActions } from "../TodoItemActions";
import { Flag } from "lucide-react";
// import { format } from "date-fns";

interface WeekTaskItemProps {
  item: TodoItem;
  sectionIndex: number;
  itemIndex: number;
  sectionTitle: string;
  config?: TodoConfig;
  editable: boolean;
  onToggle: (sectionIndex: number, itemIndex: number) => void;
  onUpdateTitle: (sectionIndex: number, itemIndex: number, newTitle: string) => void;
  onUpdateMetadata: (sectionIndex: number, itemIndex: number, metadata: TodoItemMetadata) => void;
  onRemove: (sectionIndex: number, itemIndex: number) => void;
}

export function WeekTaskItem({
  item,
  sectionIndex,
  itemIndex,
  config,
  editable,
  onToggle,
  onUpdateTitle,
  onUpdateMetadata,
  onRemove,
}: WeekTaskItemProps) {
  // Extract time from due date if available


  // Get priority info
  const priority = item.metadata?.priority;
  const priorityConfig = priority && config?.priorities?.[priority];

  // Get assignee info
  const assignee = item.metadata?.assignee;
  const assigneeConfig = assignee
    ? config?.assignees?.find(a => a.alias === assignee)
    : undefined;

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
    <div className="flex items-center gap-3 py-2 group hover:bg-accent/50 px-2 transition-colors">
      <Checkbox
        checked={item.checked}
        onCheckedChange={() => onToggle(sectionIndex, itemIndex)}
        disabled={!editable}
        className="mt-0.5 w-6 h-6 mt-0 rounded-md cursor-pointer hover:border-primary outline-2 outline-transparent hover:outline-red-400"
      />

      <div className="flex-1 flex items-baseline gap-2 min-w-0">
        {/* {timeStr && (
          <span className="text-sm font-medium text-destructive shrink-0">
            {timeStr}
          </span>
        )} */}

        {editable ? (
          <Input
            value={item.title}
            onChange={(e) => onUpdateTitle(sectionIndex, itemIndex, e.target.value)}
            className={cn(
              "flex-1 h-auto p-0 border-0 bg-transparent shadow-none focus-visible:ring-0 px-1 min-h-[1.5rem] text-xl",
              item.checked && "line-through text-muted-foreground"
            )}
            style={{ backgroundColor: "transparent" }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.currentTarget.blur();
              }
            }}
          />
        ) : (
          <span
            className={cn(
              "text-sm flex-1",
              item.checked && "line-through text-muted-foreground"
            )}
          >
            {item.title}
          </span>
        )}
      </div>

      {/* Metadata badges and actions */}
      <div className="flex items-center gap-1.5 shrink-0">
        {priorityConfig && (
          <Flag
            className="h-3 w-3"
            style={{ color: priorityConfig.color }}
            fill={priorityConfig.color}
          />
        )}

        {assigneeConfig && (
          <div
            className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium"
            title={assigneeConfig.name}
          >
            {assigneeConfig.avatar ? (
              <img
                src={assigneeConfig.avatar}
                alt={assigneeConfig.name}
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              assigneeConfig.alias.charAt(0).toUpperCase()
            )}
          </div>
        )}

        {editable && (
          <TodoItemActions
            metadata={item.metadata}
            config={config}
            onMetadataChange={handleMetadataChange}
            onRemoveMetadata={handleRemoveMetadata}
            onDelete={() => onRemove(sectionIndex, itemIndex)}
          />
        )}
      </div>
    </div>
  );
}
