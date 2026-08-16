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
    <ToggleGroup
      type="single"
      variant="outline"
      value={mode}
      onValueChange={(value: string) => {
        if (value) onModeChange(value as 'kanban' | 'week');
      }}
      className="bg-background/85 backdrop-blur-md border border-border/80 shadow-md rounded-lg p-1 gap-0.5"
    >
      <ToggleGroupItem
        value="kanban"
        aria-label="Kanban view"
        className="gap-1.5 h-6 px-2 text-xs"
      >
        <LayoutGrid className="h-3.5 w-3.5" />
        Kanban
      </ToggleGroupItem>
      <ToggleGroupItem
        value="week"
        aria-label="Week view"
        className="gap-1.5 h-6 px-2 text-xs"
      >
        <CalendarDays className="h-3.5 w-3.5" />
        Week
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
