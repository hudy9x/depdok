// import { ScrollArea } from "@/components/ui/scroll-area";
import { TodoDocument, TodoItemMetadata } from "../todoRenderer";
import { groupTasksByDate } from "./utils";
import { DaySection } from "./DaySection";
import { format } from "date-fns";

interface WeekViewProps {
  document: TodoDocument;
  editable: boolean;
  onToggleItem: (sectionIndex: number, itemIndex: number) => void;
  onUpdateItemTitle: (sectionIndex: number, itemIndex: number, newTitle: string) => void;
  onUpdateItemMetadata: (sectionIndex: number, itemIndex: number, metadata: TodoItemMetadata) => void;
  onRemoveItem: (sectionIndex: number, itemIndex: number) => void;
  onAddItem: (sectionIndex: number, metadata?: TodoItemMetadata, title?: string) => void;
}

export function WeekView({
  document,
  editable,
  onToggleItem,
  onUpdateItemTitle,
  onUpdateItemMetadata,
  onRemoveItem,
  onAddItem,
}: WeekViewProps) {
  const dayTasksArray = groupTasksByDate(document.sections);

  const handleCreateTask = (date: Date, title: string) => {
    // Find or create a default section to add the task to
    // For simplicity, we'll add to the first section or create "Todo" section
    let targetSectionIndex = 0;

    if (document.sections.length === 0) {
      // If no sections exist, we can't create a task
      // This should be handled by the parent component
      console.warn("No sections available to add task");
      return;
    }

    // Add task with due date metadata
    const dueDate = format(date, "yyyy-MM-dd");
    onAddItem(targetSectionIndex, { due: dueDate }, title);
  };

  return (
    <div className="h-full w-full overflow-y-auto flex items-start justify-center px-0 pt-6 pb-12 bg-background">
      <div className="w-full h-full">
        <div className="mx-auto max-w-lg h-full">
          {/* <ScrollArea className="h-[calc(100vh-100px)]"> */}
          <div className="space-y-0">
            {dayTasksArray.map((dayTasks, index) => (
              <DaySection
                key={dayTasks.date.toISOString()}
                dayTasks={dayTasks}
                config={document.config}
                editable={editable}
                onToggle={onToggleItem}
                onUpdateTitle={onUpdateItemTitle}
                onUpdateMetadata={onUpdateItemMetadata}
                onRemove={onRemoveItem}
                onCreateTask={handleCreateTask}
                isLast={index === dayTasksArray.length - 1}
              />
            ))}
          </div>
          {/* </ScrollArea> */}
        </div>
      </div>

    </div>
  );
}
