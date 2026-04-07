import { Virtuoso } from "react-virtuoso";
import { useMemo } from "react";
import { LogEntry } from "./types";

interface LogViewerProps {
  logs: LogEntry[];
  showMessageOnly?: boolean;
  searchTerms?: string[];
}

const HIGHLIGHT_COLORS = [
  "bg-yellow-500/30 text-yellow-500",
  "bg-green-500/30 text-green-500",
  "bg-blue-500/30 text-blue-500",
  "bg-purple-500/30 text-purple-500",
  "bg-pink-500/30 text-pink-500",
  "bg-red-500/30 text-red-500",
  "bg-orange-500/30 text-orange-500",
  "bg-teal-500/30 text-teal-500",
  "bg-cyan-500/30 text-cyan-500",
  "bg-indigo-500/30 text-indigo-500",
];

function formatTimeDiff(ms: number): string {
  if (ms < 9999) return `${ms}ms`;

  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;

  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;

  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;

  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;

  const w = Math.floor(d / 7);
  return `${w}w`;
}

function HighlightedText({ text, searchTerms }: { text: string; searchTerms?: string[] }) {
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

const levelColors: Record<string, string> = {
  info: "text-blue-500",
  debug: "text-gray-400",
  warn: "text-yellow-500",
  error: "text-red-500",
};

export function LogViewer({ logs, showMessageOnly = false, searchTerms = [] }: LogViewerProps) {
  const groupedLogs = useMemo(() => {
    const result: (LogEntry & { count: number; timeDiff?: number })[] = [];
    let lastOriginalTime: number | null = null;

    for (const log of logs) {
      const currentLogTime = new Date(log.timestamp).getTime();
      let diff: number | undefined = undefined;

      if (lastOriginalTime !== null) {
        diff = Math.max(0, currentLogTime - lastOriginalTime);
      }

      if (result.length > 0) {
        const lastGroup = result[result.length - 1];
        if (
          lastGroup.message === log.message &&
          lastGroup.level === log.level &&
          JSON.stringify(lastGroup.data) === JSON.stringify(log.data)
        ) {
          lastGroup.count += 1;
          lastOriginalTime = currentLogTime;
          continue;
        }
      }
      result.push({ ...log, count: 1, timeDiff: diff });
      lastOriginalTime = currentLogTime;
    }
    return result;
  }, [logs]);

  return (
    <div className="h-full w-full bg-[#1e1e1e] text-white font-mono text-xs pb-16">
      <Virtuoso
        data={groupedLogs}
        followOutput="smooth"
        className="h-full w-full custom-scrollbar"
        itemContent={(_, log) => {
          const colorClass = levelColors[log.level.toLowerCase()] || "text-gray-300";
          return (
            <div className="flex px-4 py-1 hover:bg-white/5 border-b border-white/5">
              {!showMessageOnly && (
                <>
                  <div className="w-56 shrink-0 text-gray-500">
                    <span>{new Date(log.timestamp).toLocaleString()}</span>
                    {log.timeDiff !== undefined && (
                      <span className="text-[10px] text-gray-400/60 ml-1.5 font-normal">
                        (+{formatTimeDiff(log.timeDiff)})
                      </span>
                    )}
                  </div>
                  <div className={`w-16 shrink-0 font-bold uppercase ${colorClass}`}>
                    {log.level}
                  </div>
                </>
              )}
              <div className="flex-1 break-all">
                {log.count > 1 && (
                  <span className="mr-2 px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 font-bold text-[10px]">
                    [x{log.count}]
                  </span>
                )}
                <HighlightedText text={log.message} searchTerms={searchTerms} />
                {!showMessageOnly && log.data && (
                  <pre className="mt-1 text-[10px] text-gray-400 opacity-80 whitespace-pre-wrap">
                    {JSON.stringify(log.data, null, 2)}
                  </pre>
                )}
              </div>
            </div>
          );
        }}
      />
    </div>
  );
}
