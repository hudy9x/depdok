import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { FileIcon } from "@/components/FileIcon";

interface FileGroupHeaderProps {
  filePath: string;
  count: number;
  isExpanded: boolean;
  onToggle: (filePath: string) => void;
}

export function FileGroupHeader({ filePath, count, isExpanded, onToggle }: FileGroupHeaderProps) {
  return (
    <div
      className="flex items-center border-t border-border gap-2 px-4 py-2 bg-muted cursor-pointer hover:bg-muted sticky top-0 z-10"
      onClick={() => onToggle(filePath)}
    >
      <ChevronRight className={cn(
        "h-4 w-4 transition-transform text-muted-foreground",
        isExpanded && "rotate-90"
      )} />
      <FileIcon filename={filePath} className="h-4 w-4 flex-shrink-0" />
      <span className="text-sm font-medium flex-1 truncate">{filePath}</span>
      <span className="text-xs text-muted-foreground">
        {count} {count === 1 ? 'result' : 'results'}
      </span>
    </div>
  );
}
