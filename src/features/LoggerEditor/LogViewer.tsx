import { Virtuoso } from "react-virtuoso";
import { useMemo } from "react";
import { LogEntry } from "./types";
import { LogListRow } from "./LogListRow";

interface LogViewerProps {
  logs: LogEntry[];
  showMessageOnly?: boolean;
  searchTerms?: string[];
}

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
    <div className="h-full w-full bg-accent text-slate-800 dark:text-white font-mono text-xs pt-2 pb-16">
      <Virtuoso
        data={groupedLogs}
        followOutput="smooth"
        className="h-full w-full custom-scrollbar"
        itemContent={(_, log) => (
          <LogListRow
            log={log}
            showMessageOnly={showMessageOnly}
            searchTerms={searchTerms}
          />
        )}
      />
    </div>
  );
}
