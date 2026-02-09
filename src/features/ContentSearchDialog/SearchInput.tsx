import { Search } from "lucide-react";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  isSearching?: boolean;
  workspaceRoot?: string;
}

export function SearchInput({ value, onChange, disabled, isSearching, workspaceRoot }: SearchInputProps) {
  return (
    <div className="flex items-center gap-3 border-b px-4 py-3">
      <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
      <input
        type="text"
        placeholder={workspaceRoot ? "Search content in workspace..." : "No workspace loaded"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="flex-1 bg-transparent outline-none text-sm disabled:opacity-50"
        autoFocus
      />
      {isSearching && (
        <span className="text-xs text-muted-foreground">Searching...</span>
      )}
    </div>
  );
}
