import { useEffect, useRef, useCallback } from "react";
import { Editor } from "@tiptap/react";
import { useAtom, useSetAtom } from "jotai";
import {
  activeCommentIdAtom,
  commentThreadsAtom,
} from "./commentStore";
import { appendComments, extractComments } from "./commentParser";
import { markFileAsDirtyAtom, markFileAsSavedAtom } from "@/stores/DirtyStore";
import { writeFileContent } from "@/lib/fileOperations";
import { draftService } from "@/lib/indexeddb";
import { isSavingAtom, lastSavedContentMap } from "@/stores/FileWatchStore";
import { isDummyPath } from "@/stores/TabStore";

interface UseCommentExtensionOptions {
  editor: Editor | null;
  content: string;
  editable: boolean;
  filePath?: string;
  onContentChange?: (content: string) => void;
  debouncedSaveDraft: (content: string) => void;
  isUpdatingRef: React.MutableRefObject<boolean>;
}

/**
 * Custom hook encapsulating all Tiptap Markdown Comment extension logic:
 * - Parsing & extracting comment thread data from raw Markdown
 * - Serializing & appending comment thread data back to Markdown
 * - Managing comment thread state and active comment ID
 * - Syncing comment mark click events and CSS active classes in the editor DOM
 * - Marking file as dirty ONLY when content actually changes from loaded/saved version
 * - Saving to disk immediately on comment modifications
 */
export function useCommentExtension({
  editor,
  content,
  editable,
  filePath,
  onContentChange,
  debouncedSaveDraft,
  isUpdatingRef,
}: UseCommentExtensionOptions) {
  const [commentThreads, setCommentThreads] = useAtom(commentThreadsAtom);
  const [activeCommentId, setActiveCommentId] = useAtom(activeCommentIdAtom);
  const markFileAsDirty = useSetAtom(markFileAsDirtyAtom);
  const markFileAsSaved = useSetAtom(markFileAsSavedAtom);
  const setIsSaving = useSetAtom(isSavingAtom);

  // Track the last known content (from load, save, or edit) to avoid false-positive dirty states
  const lastContentRef = useRef(content);
  useEffect(() => {
    lastContentRef.current = content;
  }, [content]);

  // Keep a ref to the current comment threads so onUpdate callbacks have fresh data
  const commentThreadsRef = useRef(commentThreads);
  useEffect(() => {
    commentThreadsRef.current = commentThreads;
  }, [commentThreads]);

  // Helper to save file immediately to disk when comments are added/modified
  const saveFileImmediately = useCallback(
    async (filePathToSave: string, markdownContent: string) => {
      if (!filePathToSave || isDummyPath(filePathToSave)) return;
      try {
        console.log("[useCommentExtension] 💾 Immediately saving file after comment modification:", filePathToSave);
        setIsSaving(filePathToSave);
        await writeFileContent(filePathToSave, markdownContent);
        lastSavedContentMap.set(filePathToSave, markdownContent);
        await draftService.removeDraft(filePathToSave);
        markFileAsSaved(filePathToSave);
        setTimeout(() => {
          setIsSaving(null);
        }, 1000);
      } catch (err) {
        console.error("Failed to save file after modifying comments:", err);
        setIsSaving(null);
      }
    },
    [setIsSaving, markFileAsSaved]
  );

  // Helper to process markdown changes and mark file as dirty if content actually changed
  const processContentChange = useCallback(
    (newMarkdown: string, shouldForceSave: boolean = false) => {
      const normNew = newMarkdown.replace(/\r\n/g, "\n").trim();
      const normLast = (lastContentRef.current || "").replace(/\r\n/g, "\n").trim();

      console.log('[useCommentExtension] processContentChange called | normNew === normLast?', normNew === normLast);
      if (normNew === normLast) {
        return; // Content is identical to loaded/saved version — keep clean and avoid unnecessary saves
      }

      console.log('[useCommentExtension] 🔴 Content differs! Marking file dirty:', filePath);
      lastContentRef.current = newMarkdown;
      if (filePath) {
        markFileAsDirty(filePath);
      }
      onContentChange?.(newMarkdown);
      debouncedSaveDraft(newMarkdown);

      if (shouldForceSave && filePath && !isDummyPath(filePath)) {
        saveFileImmediately(filePath, newMarkdown);
      }
    },
    [filePath, markFileAsDirty, onContentChange, debouncedSaveDraft, saveFileImmediately]
  );

  // Handle editor updates: serialize markdown with comments appended
  const handleEditorUpdate = useCallback(
    (ed: Editor) => {
      const markdownContent = appendComments(ed.getMarkdown(), commentThreadsRef.current);
      processContentChange(markdownContent);
    },
    [processContentChange]
  );

  // Extract comments on read-only content change
  useEffect(() => {
    if (editor && !editable) {
      const { cleanMarkdown, threads } = extractComments(content);
      isUpdatingRef.current = true;
      setCommentThreads(threads);
      editor.commands.setContent(cleanMarkdown, { contentType: "markdown" });
      const initialSerialized = appendComments(editor.getMarkdown(), threads);
      lastContentRef.current = initialSerialized;
      setTimeout(() => {
        isUpdatingRef.current = false;
      }, 0);
    }
  }, [content, editor, editable, setCommentThreads, isUpdatingRef]);

  // Extract comments when content changes in editable mode
  useEffect(() => {
    if (editor && editable && content) {
      const { cleanMarkdown, threads } = extractComments(content);
      isUpdatingRef.current = true;
      setCommentThreads(threads);
      editor.commands.setContent(cleanMarkdown, { contentType: "markdown" });
      const initialSerialized = appendComments(editor.getMarkdown(), threads);
      lastContentRef.current = initialSerialized;
      setTimeout(() => {
        isUpdatingRef.current = false;
      }, 0);
    }
  }, [editable, content, editor, setCommentThreads, isUpdatingRef]);

  // Re-save and mark file as dirty/saved whenever comment threads change (add reply, edit, delete, resolve)
  useEffect(() => {
    if (!editor || !editable || isUpdatingRef.current) {
      if (isUpdatingRef.current) console.log('[useCommentExtension] ⏭️ Skipping useEffect[commentThreads] because isUpdatingRef is true');
      return;
    }

    console.log('[useCommentExtension] 🔄 useEffect[commentThreads] executing');
    const markdownContent = appendComments(editor.getMarkdown(), commentThreads);
    processContentChange(markdownContent, true);
  }, [commentThreads, editor, editable, isUpdatingRef, processContentChange]);

  // Click on comment mark in editor DOM -> set activeCommentId
  useEffect(() => {
    if (!editor) return;
    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const markEl = target.closest("[data-comment-id]") as HTMLElement | null;
      if (markEl) {
        const id = markEl.getAttribute("data-comment-id");
        if (id) setActiveCommentId(id);
      }
    };
    const dom = editor.view.dom;
    dom.addEventListener("click", handleClick);
    return () => dom.removeEventListener("click", handleClick);
  }, [editor, setActiveCommentId]);

  // Sync comment-mark-active CSS class whenever activeCommentId changes
  useEffect(() => {
    if (!editor) return;
    const dom = editor.view.dom;
    dom.querySelectorAll<HTMLElement>(".comment-mark").forEach((el) => {
      const id = el.getAttribute("data-comment-id");
      el.classList.toggle(
        "comment-mark-active",
        id === activeCommentId && activeCommentId !== null
      );
    });
  }, [editor, activeCommentId]);

  return {
    handleEditorUpdate,
  };
}
