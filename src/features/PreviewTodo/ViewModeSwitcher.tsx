import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { LayoutGrid, CalendarDays } from "lucide-react";

interface ViewModeSwitcherProps {
  mode: 'kanban' | 'week';
  onModeChange: (mode: 'kanban' | 'week') => void;
  editable: boolean;
}

export function ViewModeSwitcher({ mode, onModeChange, editable }: ViewModeSwitcherProps) {
  if (!editable) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <ToggleGroup
        type="single"
        variant={"outline"}
        value={mode}
        onValueChange={(value: string) => {
          if (value) onModeChange(value as 'kanban' | 'week');
        }}
        className="bg-background border border-border shadow-lg rounded-lg p-1"
      >
        <ToggleGroupItem
          value="kanban"
          aria-label="Kanban view"
          className="gap-2"
        >
          <LayoutGrid className="h-4 w-4" />
          Kanban
        </ToggleGroupItem>
        <ToggleGroupItem
          value="week"
          aria-label="Week view"
          className="gap-2"
        >
          <CalendarDays className="h-4 w-4" />
          Week
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
}
