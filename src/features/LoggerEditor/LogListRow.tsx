import { LogEntry } from "./types";
import { levelColors, formatTimeDiff } from "./utils";
import { HighlightedText } from "./HighlightedText";

interface GroupedLogEntry extends LogEntry {
  count: number;
  timeDiff?: number;
}

interface LogListRowProps {
  log: GroupedLogEntry;
  showMessageOnly?: boolean;
  searchTerms?: string[];
}

export function LogListRow({ log, showMessageOnly, searchTerms }: LogListRowProps) {
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
}
