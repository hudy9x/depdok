import { ContentSearchResult } from "./api";
import { cn } from "@/lib/utils";

interface ResultItemProps {
  result: ContentSearchResult;
  searchQuery: string;
  onSelect: (result: ContentSearchResult) => void;
  isSelected?: boolean;
}

export function ResultItem({ result, searchQuery, onSelect, isSelected }: ResultItemProps) {
  // Helper function to truncate and highlight match in line content
  const getTruncatedContent = (content: string) => {
    const lowerContent = content.toLowerCase();
    const lowerQuery = searchQuery.toLowerCase();
    const matchIndex = lowerContent.indexOf(lowerQuery);

    if (matchIndex === -1) {
      // No match found, show beginning with ellipsis if too long
      const maxLength = 80;
      if (content.length > maxLength) {
        return content.slice(0, maxLength) + "...";
      }
      return content;
    }

    // Calculate context window around match
    const contextBefore = 30;
    const contextAfter = 50;
    const matchEnd = matchIndex + searchQuery.length;

    let startIndex = Math.max(0, matchIndex - contextBefore);
    let endIndex = Math.min(content.length, matchEnd + contextAfter);

    // Add ellipsis if we're cutting content
    const prefix = startIndex > 0 ? "..." : "";
    const suffix = endIndex < content.length ? "..." : "";

    const visibleContent = content.slice(startIndex, endIndex);
    const adjustedMatchIndex = matchIndex - startIndex;

    return (
      <>
        {prefix}
        {visibleContent.slice(0, adjustedMatchIndex)}
        <span className="bg-green-200 dark:bg-green-800 text-foreground">
          {visibleContent.slice(adjustedMatchIndex, adjustedMatchIndex + searchQuery.length)}
        </span>
        {visibleContent.slice(adjustedMatchIndex + searchQuery.length)}
        {suffix}
      </>
    );
  };

  return (
    <div
      className={cn(
        "flex gap-3 px-4 py-1.5 cursor-pointer border-l-2 transition-colors",
        "bg-background",
        isSelected
          ? "bg-accent border-primary"
          : "border-transparent hover:bg-accent hover:border-primary"
      )}
      onClick={() => onSelect(result)}
    >
      <code className="text-xs font-mono flex-1 truncate">
        {getTruncatedContent(result.line_content)}
      </code>
      <span className="text-muted-foreground text-xs w-12 text-right flex-shrink-0 font-mono">
        {result.line_number}
      </span>
    </div>
  );
}
