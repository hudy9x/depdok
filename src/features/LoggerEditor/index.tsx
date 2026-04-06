import { useState, useRef, useEffect, useMemo } from "react";
import { listen } from "@tauri-apps/api/event";
import { startLoggerServer, registerLoggerChannel } from "@/api-client/logger";
import { LogEntry } from "./types";
import { LoggerHeader } from "./LoggerHeader";
import { LogViewer } from "./LogViewer";

interface LoggerEditorProps {
  filePath: string;
}

export function LoggerEditor({ filePath }: LoggerEditorProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [serverUrl, setServerUrl] = useState<string>("");
  const [isServerRunning, setIsServerRunning] = useState(false);
  const [filterText, setFilterText] = useState("");
  const [filterLevel, setFilterLevel] = useState("all");
  const [showMessageOnly, setShowMessageOnly] = useState(false);
  const unlistenRef = useRef<(() => void) | undefined>(undefined);

  useEffect(() => {
    return () => {
      if (unlistenRef.current) {
        unlistenRef.current();
        unlistenRef.current = undefined;
      }
    };
  }, []);

  const channel = filePath.split(/[/\\]/).pop()?.replace('.logger', '') || 'default';
  const outLogPath = filePath.replace('.logger', '.out.log');

  const handleStart = async () => {
    try {
      const url = await startLoggerServer();
      setServerUrl(url);
      await registerLoggerChannel(channel, outLogPath);

      const unlistenFn = await listen<{ channel: string; data: any }>(
        "logger-event",
        (event) => {
          if (event.payload.channel === channel) {
            setLogs((prev) => [
              ...prev,
              {
                id: Math.random().toString(36).substring(7),
                level: event.payload.data.level || "info",
                message: event.payload.data.message || "",
                data: event.payload.data.data,
                timestamp: event.payload.data.timestamp || new Date().toISOString(),
              },
            ]);
          }
        }
      );
      unlistenRef.current = unlistenFn;
      setIsServerRunning(true);
    } catch (err) {
      console.error("Failed to start logger server", err);
    }
  };

  const handleStop = () => {
    if (unlistenRef.current) {
      unlistenRef.current();
      unlistenRef.current = undefined;
    }
    setIsServerRunning(false);
  };

  const handleToggleServer = () => {
    if (isServerRunning) {
      handleStop();
    } else {
      handleStart();
    }
  };

  const parsedSearchTerms = useMemo(() => {
    if (!filterText.trim()) return [];
    if (filterText.trim().toLowerCase().startsWith('search:')) {
      const query = filterText.trim().substring(7);
      const matches = [...query.matchAll(/"([^"]*)"|([^,]+)/g)];
      return matches
        .map(m => (m[1] !== undefined ? m[1] : m[2]).trim().toLowerCase())
        .filter(Boolean);
    }
    return [filterText.trim().toLowerCase()];
  }, [filterText]);

  const filteredLogs = logs.filter((log) => {
    if (filterLevel !== "all" && log.level.toLowerCase() !== filterLevel) return false;
    if (parsedSearchTerms.length > 0) {
      const messageLower = log.message.toLowerCase();
      const matchesAny = parsedSearchTerms.some(term => messageLower.includes(term));
      if (!matchesAny) return false;
    }
    return true; 
  });

  return (
    <div className="flex flex-col h-full w-full bg-background border-t border-border">
      <LoggerHeader 
        channel={channel}
        serverUrl={serverUrl}
        isServerRunning={isServerRunning}
        onToggleServer={handleToggleServer}
        filterText={filterText}
        onFilterTextChange={setFilterText}
        filterLevel={filterLevel}
        onFilterLevelChange={setFilterLevel}
        onClear={() => setLogs([])}
        showMessageOnly={showMessageOnly}
        onShowMessageOnlyChange={setShowMessageOnly}
      />
      <div className="flex-1 overflow-hidden">
        {/* We pass logs or filtered logs here, but if isServerRunning is false, we might want to stop appending in the UI, actually we handle it in render to allow clearing to still work. Or handle freeze in the event listener! */}
        <LogViewer logs={filteredLogs} showMessageOnly={showMessageOnly} searchTerms={parsedSearchTerms} />
      </div>
    </div>
  );
}
