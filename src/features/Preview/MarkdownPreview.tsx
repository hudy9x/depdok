import { useEffect, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { useAtomValue, useSetAtom } from "jotai";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { common, createLowlight } from "lowlight";
import { useDebouncedCallback } from "use-debounce";
import "highlight.js/styles/github-dark.css";
import "./markdown.css";

import { createTauriImage } from "./TauriImage";
import { editorStateAtom, markAsDirtyAtom } from "@/stores/EditorStore";
import { draftService } from "@/lib/indexeddb";

const lowlight = createLowlight(common);

interface MarkdownPreviewProps {
  content: string;
  editable?: boolean;
  onContentChange?: (content: string) => void;
}

export function MarkdownPreview({
  content,
  editable = false,
  onContentChange
}: MarkdownPreviewProps) {
  const editorState = useAtomValue(editorStateAtom);
  const markAsDirty = useSetAtom(markAsDirtyAtom);
  const TauriImage = createTauriImage(editorState.filePath);
  const isUpdatingRef = useRef(false);

  console.log('MarkdownPreview', content)

  // Debounced draft save (only when editable)
  const debouncedSaveDraft = useDebouncedCallback(async (newContent: string) => {
    if (!editorState.filePath || !editable) return;
    await draftService.saveDraft(editorState.filePath, newContent);
    markAsDirty();
  }, 500);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false, // Disable default code block
      }),
      CodeBlockLowlight.configure({
        lowlight,
      }),
      Markdown,
      TauriImage,
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
    ],
    content: "",
    contentType: 'markdown', // Enable markdown mode
    editable: editable,
    editorProps: {
      attributes: {
        class: "prose prose-sm sm:prose lg:prose-lg dark:prose-invert max-w-none p-8 focus:outline-none",
      },
    },
    onUpdate: ({ editor }) => {
      if (editable && !isUpdatingRef.current) {
        // Get markdown content using getMarkdown from @tiptap/markdown v3.14.0
        const markdownContent = editor.getMarkdown();
        onContentChange?.(markdownContent);
        debouncedSaveDraft(markdownContent);
      }
    },
  });

  useEffect(() => {
    if (editor && !editable) {
      // Only update content when not in editable mode to prevent jumping
      isUpdatingRef.current = true;
      console.log('MarkdownPreview', content)
      editor.commands.setContent(content, { contentType: 'markdown' });
      isUpdatingRef.current = false;
    }
  }, [content, editor, editable]);

  // Set initial content when switching to editable mode OR when content changes in editable mode
  useEffect(() => {
    if (editor && editable && content) {
      isUpdatingRef.current = true;
      editor.commands.setContent(content, { contentType: 'markdown' });
      isUpdatingRef.current = false;
    }
  }, [editable, content, editor]);

  return (
    <div className="w-full h-full overflow-auto bg-background">
      <EditorContent editor={editor} />
    </div>
  );
}
