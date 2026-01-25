import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

interface CreateTaskButtonProps {
  onCreateTask: () => void;
}

export function CreateTaskButton({ onCreateTask }: CreateTaskButtonProps) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="w-full justify-start text-muted-foreground hover:text-foreground mt-1"
      onClick={onCreateTask}
    >
      <Plus className="h-4 w-4 mr-1" />
      Create
    </Button>
  );
}
