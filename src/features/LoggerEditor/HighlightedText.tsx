import { HIGHLIGHT_COLORS } from "./utils";

interface HighlightedTextProps {
  text: string;
  searchTerms?: string[];
}

export function HighlightedText({ text, searchTerms }: HighlightedTextProps) {
  if (!searchTerms || searchTerms.length === 0) return <>{text}</>;

  const escapedTerms = searchTerms.map(term => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const regex = new RegExp(`(${escapedTerms.join('|')})`, 'gi');

  const parts = text.split(regex);

  return (
    <>
      {parts.map((part, i) => {
        const termIndex = searchTerms.findIndex(term => term.toLowerCase() === part.toLowerCase());
        if (termIndex !== -1) {
          const colorClass = HIGHLIGHT_COLORS[termIndex % HIGHLIGHT_COLORS.length];
          return (
            <mark key={i} className={`${colorClass} font-bold rounded px-0.5`}>
              {part}
            </mark>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}
