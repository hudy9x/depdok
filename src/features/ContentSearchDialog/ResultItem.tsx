import { ContentSearchResult } from "./api";

interface ResultItemProps {
  result: ContentSearchResult;
  searchQuery: string;
  onSelect: (result: ContentSearchResult) => void;
}

export function ResultItem({ result, searchQuery, onSelect }: ResultItemProps) {
  // Helper function to highlight match in line content
  const highlightMatch = (content: string) => {
    const lowerContent = content.toLowerCase();
    const lowerQuery = searchQuery.toLowerCase();
    const index = lowerContent.indexOf(lowerQuery);

    if (index !== -1) {
      return (
        <>
          {content.slice(0, index)}
          <span className="bg-yellow-200 dark:bg-yellow-900 text-foreground">
            {content.slice(index, index + searchQuery.length)}
          </span>
          {content.slice(index + searchQuery.length)}
        </>
      );
    }
    return content;
  };

  return (
    <div
      className="flex gap-3 px-4 py-1.5 hover:bg-accent cursor-pointer border-l-2 border-transparent hover:border-primary ml-4"
      onClick={() => onSelect(result)}
    >
      <span className="text-muted-foreground text-xs w-12 text-right flex-shrink-0 font-mono">
        {result.line_number}
      </span>
      <code className="text-sm font-mono flex-1 truncate">
        {highlightMatch(result.line_content)}
      </code>
    </div>
  );
}
