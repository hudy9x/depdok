import { useEffect, useRef, useCallback } from "react";
import { Editor } from "@tiptap/react";
import { useAtom, useSetAtom } from "jotai";
import {
  fileActiveCommentIdAtomFamily,
  fileCommentThreadsAtomFamily,
} from "./commentStore";
import { appendComments, extractComments } from "./commentParser";
import { extractFrontmatter, prependFrontmatter } from "../../utils/frontmatter";
import { markFileAsDirtyAtom } from "@/stores/DirtyStore";

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
 */
export function useCommentExtension({
  editor,
  content,
  editable,
  filePath = "",
  onContentChange,
  debouncedSaveDraft,
  isUpdatingRef,
}: UseCommentExtensionOptions) {
  const [commentThreads, setCommentThreads] = useAtom(fileCommentThreadsAtomFamily(filePath));
  const [activeCommentId, setActiveCommentId] = useAtom(fileActiveCommentIdAtomFamily(filePath));
  const markFileAsDirty = useSetAtom(markFileAsDirtyAtom);

  // Track the raw YAML frontmatter (if present) so it is preserved across saves
  const rawFrontmatterRef = useRef<string | null>(null);

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

  // Helper to process markdown changes and mark file as dirty if content actually changed
  const processContentChange = useCallback(
    (newMarkdown: string) => {
      const normNew = newMarkdown.replace(/\r\n/g, "\n").trim();
      const normLast = (lastContentRef.current || "").replace(/\r\n/g, "\n").trim();

      console.log('[useCommentExtension] processContentChange called | normNew === normLast?', normNew === normLast);
      if (normNew === normLast) {
        return; // Content is identical to loaded/saved version — keep clean and avoid unnecessary state updates
      }

      console.log('[useCommentExtension] 🔴 Content differs! Marking file dirty:', filePath);
      lastContentRef.current = newMarkdown;
      if (filePath) {
        markFileAsDirty(filePath);
      }
      onContentChange?.(newMarkdown);
      debouncedSaveDraft(newMarkdown);
    },
    [filePath, markFileAsDirty, onContentChange, debouncedSaveDraft]
  );

  // Handle editor updates: serialize markdown with comments appended and frontmatter preserved
  const handleEditorUpdate = useCallback(
    (ed: Editor) => {
      let currentRawFrontmatter = rawFrontmatterRef.current;
      ed.state.doc.descendants((node) => {
        if (node.type.name === "documentProperties") {
          currentRawFrontmatter = node.attrs.raw || "";
          rawFrontmatterRef.current = currentRawFrontmatter;
          return false;
        }
      });

      const markdownContent = prependFrontmatter(
        appendComments(ed.getMarkdown(), commentThreadsRef.current),
        currentRawFrontmatter
      );
      processContentChange(markdownContent);
    },
    [processContentChange]
  );

  // Extract frontmatter & comments on read-only content change
  useEffect(() => {
    if (editor && !editable) {
      const { rawFrontmatter, metadata, body } = extractFrontmatter(content);
      rawFrontmatterRef.current = rawFrontmatter;
      const { cleanMarkdown, threads } = extractComments(body);
      isUpdatingRef.current = true;
      setCommentThreads(threads);
      const editorInput = rawFrontmatter
        ? `<div data-type="document-properties" data-raw="${encodeURIComponent(rawFrontmatter)}" data-metadata="${encodeURIComponent(JSON.stringify(metadata || {}))}" data-file-path="${encodeURIComponent(filePath)}"></div>\n\n${cleanMarkdown}`
        : cleanMarkdown;
      editor.commands.setContent(editorInput, { contentType: "markdown" });
      const initialSerialized = prependFrontmatter(
        appendComments(editor.getMarkdown(), threads),
        rawFrontmatter
      );
      lastContentRef.current = initialSerialized;
      setTimeout(() => {
        isUpdatingRef.current = false;
      }, 0);
    }
  }, [content, editor, editable, filePath, setCommentThreads, isUpdatingRef]);

  // Extract frontmatter & comments when content changes in editable mode
  useEffect(() => {
    if (editor && editable && content) {
      const { rawFrontmatter, metadata, body } = extractFrontmatter(content);
      rawFrontmatterRef.current = rawFrontmatter;
      const { cleanMarkdown, threads } = extractComments(body);
      isUpdatingRef.current = true;
      setCommentThreads(threads);
      const editorInput = rawFrontmatter
        ? `<div data-type="document-properties" data-raw="${encodeURIComponent(rawFrontmatter)}" data-metadata="${encodeURIComponent(JSON.stringify(metadata || {}))}" data-file-path="${encodeURIComponent(filePath)}"></div>\n\n${cleanMarkdown}`
        : cleanMarkdown;
      editor.commands.setContent(editorInput, { contentType: "markdown" });
      const initialSerialized = prependFrontmatter(
        appendComments(editor.getMarkdown(), threads),
        rawFrontmatter
      );
      lastContentRef.current = initialSerialized;
      setTimeout(() => {
        isUpdatingRef.current = false;
      }, 0);
    }
  }, [editable, content, editor, filePath, setCommentThreads, isUpdatingRef]);

  // Re-save and mark file as dirty whenever comment threads change (add reply, edit, delete, resolve)
  useEffect(() => {
    if (!editor || !editable || isUpdatingRef.current) {
      if (isUpdatingRef.current) console.log('[useCommentExtension] ⏭️ Skipping useEffect[commentThreads] because isUpdatingRef is true');
      return;
    }

    console.log('[useCommentExtension] 🔄 useEffect[commentThreads] executing');
    let currentRawFrontmatter = rawFrontmatterRef.current;
    editor.state.doc.descendants((node) => {
      if (node.type.name === "documentProperties") {
        currentRawFrontmatter = node.attrs.raw || "";
        rawFrontmatterRef.current = currentRawFrontmatter;
        return false;
      }
    });

    const markdownContent = prependFrontmatter(
      appendComments(editor.getMarkdown(), commentThreads),
      currentRawFrontmatter
    );
    processContentChange(markdownContent);
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
