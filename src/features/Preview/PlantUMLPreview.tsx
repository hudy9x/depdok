
interface PlantUMLPreviewProps {
  content: string;
}

export function PlantUMLPreview({ content }: PlantUMLPreviewProps) {
  return (
    <div className="w-full h-full p-4 overflow-auto bg-white dark:bg-zinc-950">
      <div className="text-center text-muted-foreground">
        PlantUML Preview (Placeholder)
      </div>
      <pre className="text-xs mt-4 p-2 bg-muted rounded">
        {content}
      </pre>
    </div>
  );
}
