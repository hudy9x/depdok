import { useEffect, useRef } from "react";

interface UseLineJumpOptions {
  editorRef: React.MutableRefObject<any>;
  lineNumber?: number;
}

/**
 * Custom hook to handle jumping to a specific line in Monaco Editor
 * Handles cases where the editor might not be ready yet (e.g., during theme loading)
 */
export function useLineJump({ editorRef, lineNumber }: UseLineJumpOptions) {
  const pendingLineNumberRef = useRef<number | undefined>(undefined);

  // Jump to line when lineNumber changes
  useEffect(() => {
    console.log('[useLineJump] Line number changed:', lineNumber, 'editorRef:', editorRef.current);

    if (lineNumber !== undefined && lineNumber > 0) {
      // Store the pending line number
      pendingLineNumberRef.current = lineNumber;

      // Try to jump immediately if editor is ready
      if (editorRef.current) {
        console.log('[useLineJump] Editor ready, jumping to line:', lineNumber);
        editorRef.current.revealLineInCenter(lineNumber);
        editorRef.current.setPosition({ lineNumber, column: 1 });
        editorRef.current.focus();
        pendingLineNumberRef.current = undefined;
      } else {
        console.log('[useLineJump] Editor not ready, will jump when mounted');
      }
    }
  }, [lineNumber, editorRef]);

  // Jump to pending line after editor mounts
  useEffect(() => {
    if (editorRef.current && pendingLineNumberRef.current !== undefined && pendingLineNumberRef.current > 0) {
      console.log('[useLineJump] Editor mounted, jumping to pending line:', pendingLineNumberRef.current);
      const lineToJump = pendingLineNumberRef.current;

      // Small delay to ensure editor is fully ready
      setTimeout(() => {
        editorRef.current?.revealLineInCenter(lineToJump);
        editorRef.current?.setPosition({ lineNumber: lineToJump, column: 1 });
        editorRef.current?.focus();
      }, 100);

      pendingLineNumberRef.current = undefined;
    }
  }, [editorRef.current, editorRef]);
}
