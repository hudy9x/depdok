import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus } from "lucide-react";

interface KanbanCreateTaskButtonProps {
  onCreateTask: (title: string) => void;
  className?: string;
}

export function KanbanCreateTaskButton({ onCreateTask, className = "" }: KanbanCreateTaskButtonProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [title, setTitle] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = () => {
    if (title.trim()) {
      onCreateTask(title.trim());
      setTitle("");
      // Keep input focused to allow multiple task creation
      inputRef.current?.focus();
    } else {
      setIsCreating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSubmit();
    } else if (e.key === "Escape") {
      setIsCreating(false);
      setTitle("");
    }
  };

  const handleBlur = (e: React.FocusEvent) => {
    // If the new focused element is outside this component, close the input
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setIsCreating(false);
      setTitle("");
    }
  };

  if (isCreating) {
    return (
      <div
        className={`flex items-center gap-2 mt-1 w-full ${className}`}
        onBlur={handleBlur}
      >
        <Input
          ref={inputRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="New Item..."
          className="h-8 flex-1 text-sm bg-background/50 border-dashed focus-visible:ring-1"
          autoFocus
        />
        <Button
          type="button"
          size="sm"
          className="h-8 px-3 shrink-0"
          onClick={handleSubmit}
        >
          OK
        </Button>
      </div>
    );
  }

  return (
    <Button
      variant="ghost"
      className={`w-full justify-start mt-1 hover:bg-transparent text-muted-foreground ${className}`}
      onClick={() => setIsCreating(true)}
    >
      <Plus className="h-4 w-4 ml-1 mr-1" /> Add Item
    </Button>
  );
}
