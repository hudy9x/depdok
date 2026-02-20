import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { GripVertical } from "lucide-react";

interface DraggingBoardOverlayProps {
  title: string;
  itemsCount: number;
}

export function DraggingBoardOverlay({ title, itemsCount }: DraggingBoardOverlayProps) {
  return (
    <Card className="w-80 pb-0 pt-4 shadow-xl border-dashed rounded-sm opacity-90 border-primary rotate-1">
      <CardHeader className="px-4 flex flex-row items-center gap-2 space-y-0">
        <GripVertical className="w-4 h-4 text-muted-foreground" />
        <span className="font-semibold text-lg">{title}</span>
      </CardHeader>
      <CardContent className="px-4 pb-4 text-sm text-muted-foreground">
        {itemsCount} item{itemsCount !== 1 ? "s" : ""}
      </CardContent>
    </Card>
  );
}
