import { TodoConfig, TodoItemMetadata } from "../todoRenderer";
import { DayTasks, formatDayHeader } from "./utils";
import { WeekTaskItem } from "./WeekTaskItem";
import { CreateTaskButton } from "./CreateTaskButton";
import { Separator } from "@/components/ui/separator";

interface DaySectionProps {
  dayTasks: DayTasks;
  config?: TodoConfig;
  editable: boolean;
  onToggle: (sectionIndex: number, itemIndex: number) => void;
  onUpdateTitle: (sectionIndex: number, itemIndex: number, newTitle: string) => void;
  onUpdateMetadata: (sectionIndex: number, itemIndex: number, metadata: TodoItemMetadata) => void;
  onRemove: (sectionIndex: number, itemIndex: number) => void;
  onCreateTask: (date: Date, title: string) => void;
  isLast?: boolean;
}

export function DaySection({
  dayTasks,
  config,
  editable,
  onToggle,
  onUpdateTitle,
  onUpdateMetadata,
  onRemove,
  onCreateTask,
  isLast = false,
}: DaySectionProps) {
  const { label, dateStr } = formatDayHeader(dayTasks.date);

  return (
    <div className="py-4">
      {/* Day header */}
      <div className="flex items-baseline gap-2 mb-3 px-2">
        <h3 className="text-lg font-semibold">{label}</h3>
        <span className="text-sm text-muted-foreground/50">{dateStr}</span>
      </div>

      {/* Separator */}
      {!isLast && <Separator className="mt-4" />}


      {/* Tasks list */}
      <div className="space-y-1 divide-y divide-border divide-dashed">
        {dayTasks.tasks.length > 0 ? (
          dayTasks.tasks.map((task, idx) => (
            <WeekTaskItem
              key={`${task.sectionIndex}-${task.itemIndex}-${idx}`}
              item={task.item}
              sectionIndex={task.sectionIndex}
              itemIndex={task.itemIndex}
              sectionTitle={task.sectionTitle}
              config={config}
              editable={editable}
              onToggle={onToggle}
              onUpdateTitle={onUpdateTitle}
              onUpdateMetadata={onUpdateMetadata}
              onRemove={onRemove}
            />
          ))
        ) : (
          <p className="mt-3 text-sm text-muted-foreground italic px-4 py-4 bg-accent border border-border border-dashed rounded-lg">
            No tasks for this day
          </p>
        )}
      </div>

      {/* Create button */}
      {editable && (
        <div className="mt-2 px-2">
          <CreateTaskButton onCreateTask={(title) => onCreateTask(dayTasks.date, title)} />
        </div>
      )}

    </div>
  );
}
