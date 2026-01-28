import { FileText } from "lucide-react";

export function EditorEmptyState() {
  return (
    <div className="fixed top-[35px] h-[calc(100vh-35px)] left-0 w-full flex flex-col items-center justify-center bg-secondary">
      <div className="flex flex-col items-center gap-6 max-w-md text-center px-8">
        {/* Icon */}
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
          <FileText className="w-8 h-8 text-primary" />
        </div>

        {/* Header */}
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold">No Files Open</h2>
          <p className="text-muted-foreground text-sm">
            You haven't opened any files yet. Get started by opening a file from the menu bar.
          </p>
        </div>

        {/* Keyboard Shortcuts */}
        <div className="flex flex-col gap-2 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <kbd className="px-2 py-1 bg-background border border-border rounded shadow-sm font-mono text-xs">
              File → Open File
            </kbd>
            <span>to open an existing file</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <kbd className="px-2 py-1 bg-background border border-border rounded shadow-sm font-mono text-xs">
              Cmd+O
            </kbd>
            <span>keyboard shortcut</span>
          </div>
        </div>
      </div>
    </div>
  );
}
