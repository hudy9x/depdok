import * as React from "react";
import { useAtomValue } from "jotai";
import { Folder } from "lucide-react";

import { FileIcon } from "@/components/FileIcon";
import { workspaceRootAtom } from "@/features/FileExplorer/store";

interface EditorBreadcrumbsProps {
  filePath: string;
}

export function EditorBreadcrumbs({ filePath }: EditorBreadcrumbsProps): React.JSX.Element | null {
  const workspaceRoot = useAtomValue(workspaceRootAtom);

  if (!filePath) {
    return null;
  }

  // Format breadcrumbs path: relative to workspaceRoot split by arrows
  const getBreadcrumbs = (): string[] => {
    let relPath = filePath;
    if (workspaceRoot && filePath.startsWith(workspaceRoot)) {
      relPath = filePath.slice(workspaceRoot.length);
    }
    relPath = relPath.replace(/^[/\\]+/, "");
    return relPath.split(/[/\\]/).filter(Boolean);
  };

  const segments = getBreadcrumbs();

  if (segments.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-1 text-[11px] text-muted-foreground truncate select-none font-mono">
      {segments.map((segment, idx) => {
        const isLast = idx === segments.length - 1;
        return (
          <div key={idx} className="flex items-center gap-1">
            {idx > 0 && (
              <span className="text-muted-foreground font-mono text-[9px] mx-0.5">
                &gt;
              </span>
            )}
            <div className="flex items-center gap-1.5 py-0.5 px-1 rounded hover:bg-muted/30 transition-colors">
              {isLast ? (
                <>
                  <FileIcon filename={segment} className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="font-semibold text-foreground/80 lowercase">
                    {segment}
                  </span>
                </>
              ) : (
                <>
                  <Folder className="w-3.5 h-3.5 text-muted-foreground/60 fill-muted-foreground/10 flex-shrink-0" />
                  <span className="hover:text-foreground cursor-pointer lowercase transition-colors">
                    {segment}
                  </span>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
