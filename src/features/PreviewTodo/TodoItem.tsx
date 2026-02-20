import { useState, useRef, useEffect } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { TodoItem as TodoItemType, TodoConfig, TodoItemMetadata } from "./todoRenderer";
import { DueDateDisplay, AssigneeDisplay, PriorityDisplay } from "./TodoItemMetadataDisplay";
import { TodoItemActions } from "./TodoItemActions";

// Simple hook to auto-resize textarea
const useAutosizeTextArea = (
  textAreaRef: HTMLTextAreaElement | null,
  value: string
) => {
  useEffect(() => {
    if (textAreaRef) {
      textAreaRef.style.height = "0px";
      const scrollHeight = textAreaRef.scrollHeight;
      textAreaRef.style.height = scrollHeight + "px";
    }
  }, [textAreaRef, value]);
};

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
  const [isEditing, setIsEditing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Focus textarea when entering edit mode
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      // Place cursor at end of text
      textareaRef.current.setSelectionRange(
        textareaRef.current.value.length,
        textareaRef.current.value.length
      );
    }
  }, [isEditing]);

  const handleMetadataChange = (field: keyof TodoItemMetadata, value: any) => {
    const newMetadata = { ...item.metadata, [field]: value };
    onUpdateMetadata(sectionIndex, itemIndex, newMetadata);
  };

  const handleRemoveMetadata = (field: keyof TodoItemMetadata) => {
    const newMetadata = { ...item.metadata };
    delete newMetadata[field];
    onUpdateMetadata(sectionIndex, itemIndex, newMetadata);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      setIsEditing(false);
    }
    if (e.key === "Escape") {
      setIsEditing(false);
    }
  };

  // Auto-resize textarea when value changes
  useAutosizeTextArea(textareaRef.current, item.title);

  return (
    <div className={`group relative flex flex-row items-start gap-3 p-4 shadow-sm rounded-xl border border-border bg-accent hover:shadow-md transition-all ${item.checked && "opacity-60"}`}>

      {/* Left: Checkbox */}
      <div className="pt-0.5">
        <Checkbox
          checked={item.checked}
          onCheckedChange={() => onToggle(sectionIndex, itemIndex)}
          disabled={!editable}
          className="rounded-md data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
        />
      </div>

      {/* Middle: Content */}
      <div className="flex-1 flex flex-col min-w-0 gap-1.5">
        {/* Title */}
        <div className="w-full">
          {isEditing && editable ? (
            <textarea
              ref={textareaRef}
              rows={1}
              value={item.title}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onUpdateTitle(sectionIndex, itemIndex, e.target.value)}
              onBlur={() => setIsEditing(false)}
              onKeyDown={handleKeyDown}
              className="w-full resize-none bg-transparent border-none p-0 text-sm font-medium focus:ring-0 focus:outline-none placeholder:text-muted-foreground/50 overflow-hidden leading-normal"
              spellCheck={false}
            />
          ) : (
            <div
              className={cn(
                "text-sm font-medium break-words cursor-pointer leading-normal line-clamp-4",
                item.checked && "line-through text-muted-foreground"
              )}
              onDoubleClick={() => editable && setIsEditing(true)}
              onClick={() => editable && setIsEditing(true)}
              title={item.title}
            >
              {item.title}
            </div>
          )}
        </div>

        {/* Subtitle / Metadata Row */}
        {(item.metadata?.due || item.metadata?.priority || (editable && isEditing)) && (
          <div className="flex gap-1">
            {item.metadata?.due && (
              <DueDateDisplay
                due={item.metadata.due}
                editable={editable}
                onUpdate={(val) => handleMetadataChange("due", val)}
              />
            )}

            {item.metadata?.priority && (
              <PriorityDisplay
                priority={item.metadata.priority}
                config={config}
              />
            )}

            {/* If we want to allow adding metadata here when empty, we could add a trigger */}
          </div>
        )}
      </div>

      {/* Right: Avatar & Actions */}
      <div className="relative flex items-center justify-end shrink-0 self-start min-w-[20px]">
        {item.metadata?.assignee && (
          <div className="absolute right-0 top-3 -translate-y-1/2 transition-opacity group-hover:opacity-0">
            <AssigneeDisplay
              assignee={item.metadata.assignee}
              config={config}
            />
          </div>
        )}

        {editable && (
          <div className="absolute right-0 top-3 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 z-10">
            <TodoItemActions
              metadata={item.metadata}
              config={config}
              onMetadataChange={handleMetadataChange}
              onRemoveMetadata={handleRemoveMetadata}
              onDelete={() => onRemove(sectionIndex, itemIndex)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
