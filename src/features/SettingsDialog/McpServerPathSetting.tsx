import { useEffect, useState } from "react";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { toast } from "sonner";

import { getMcpServerPaths } from "@/api-client/mcp";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export function McpServerPathSetting() {
  const [paths, setPaths] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const detectPaths = async () => {
      try {
        const availablePaths = await getMcpServerPaths();

        if (!cancelled) {
          setPaths(availablePaths);
        }
      } catch (error) {
        console.error("[McpServerPathSetting] Failed to detect MCP path:", error);
        if (!cancelled) {
          setPaths([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    detectPaths();

    return () => {
      cancelled = true;
    };
  }, []);

  const copyPath = async (value: string) => {
    try {
      await writeText(value);
      toast.success("Copied MCP server path");
    } catch (error) {
      console.error("[McpServerPathSetting] Failed to copy path:", error);
      toast.error("Failed to copy path");
    }
  };

  return (
    <div className="space-y-2">
      <div className="space-y-0.5">
        <Label>MCP Server Path</Label>
        <p className="text-sm text-muted-foreground">
          Use this path in your AI client MCP config command field.
        </p>
      </div>

      {loading && (
        <p className="text-xs text-muted-foreground">Checking installed MCP server path...</p>
      )}

      {!loading && paths.length > 0 && (
        <div className="space-y-2">
          {paths.map((pathValue) => (
            <div
              key={pathValue}
              className="flex items-center gap-2 rounded-md border border-border bg-muted/50 px-2 py-1.5"
            >
              <code className="flex-1 text-xs ">{pathValue}</code>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => copyPath(pathValue)}
              >
                Copy
              </Button>
            </div>
          ))}
        </div>
      )}

      {!loading && paths.length === 0 && (
        <p className="text-xs text-muted-foreground">
          MCP server binary was not found in /Applications or ~/Applications. If you installed Depdok in a custom location, run: <code>find /Applications ~/Applications -name depdok-mcp-server 2&gt;/dev/null</code>
        </p>
      )}
    </div>
  );
}
