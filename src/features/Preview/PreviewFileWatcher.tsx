import { useCallback, useState, useEffect } from "react";
import { useAtomValue } from "jotai";
import { editorStateAtom } from "@/stores/EditorStore";
import { useFileWatcher } from "@/hooks/useFileWatcher";

interface PreviewFileWatcherProps {
  content: string;
  enableFileWatcher?: boolean;
  onContentReload: (newContent: string) => void;
  children: (content: string) => React.ReactNode;
}

/**
 * Wrapper component that adds file watching capability to preview components
 * Only used when preview is in standalone mode (not in side-by-side)
 */
export function PreviewFileWatcher({
  content: initialContent,
  enableFileWatcher = false,
  onContentReload,
  children,
}: PreviewFileWatcherProps) {
  const [content, setContent] = useState(initialContent);
  const editorState = useAtomValue(editorStateAtom);

  // Sync content when initialContent changes
  useEffect(() => {
    setContent(initialContent);
  }, [initialContent]);

  // File watcher hook - reloads content when file changes externally
  const handleContentReload = useCallback(
    (newContent: string) => {
      setContent(newContent);
      onContentReload(newContent);
    },
    [onContentReload]
  );

  // Only enable file watcher if explicitly requested
  // Preview mode: show confirmation dialog before reloading
  useFileWatcher({
    filePath: enableFileWatcher ? editorState.filePath || "" : "",
    onContentReload: handleContentReload,
    autoReload: false, // Show confirmation in preview mode
  });

  return <>{children(content)}</>;
}
