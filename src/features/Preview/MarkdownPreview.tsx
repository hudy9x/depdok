import { useEffect, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { useAtomValue, useSetAtom } from "jotai";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import FileHandler from "@tiptap/extension-file-handler";
import { common, createLowlight } from "lowlight";
import { useDebouncedCallback } from "use-debounce";
import "highlight.js/styles/github-dark.css";
import "./markdown.css";
import { ScrollArea } from "@/components/ui/scroll-area";

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
      FileHandler.configure({
        allowedMimeTypes: ['image/png', 'image/jpeg', 'image/gif', 'image/webp'],
        onDrop: (currentEditor, files, pos) => {
          console.log('[FileHandler] onDrop triggered', { files, pos });
          files.forEach(file => {
            console.log('[FileHandler] Processing dropped file:', file.name, file.type);
            const fileReader = new FileReader();

            fileReader.readAsDataURL(file);
            fileReader.onload = () => {
              console.log('[FileHandler] File loaded, inserting at position:', pos);
              currentEditor
                .chain()
                .insertContentAt(pos, {
                  type: 'image',
                  attrs: {
                    src: fileReader.result,
                  },
                })
                .focus()
                .run();
            };
          });
        },
        onPaste: (currentEditor, files, htmlContent) => {
          console.log('[FileHandler] onPaste triggered', { files, htmlContent });
          files.forEach(file => {
            if (htmlContent) {
              // If there is htmlContent, stop manual insertion & let other extensions handle insertion
              console.log('[FileHandler] htmlContent present, skipping manual insertion');
              return false;
            }

            console.log('[FileHandler] Processing pasted file:', file.name, file.type);
            const fileReader = new FileReader();

            fileReader.readAsDataURL(file);
            fileReader.onload = () => {
              console.log('[FileHandler] File loaded, inserting at cursor');
              currentEditor
                .chain()
                .insertContentAt(currentEditor.state.selection.anchor, {
                  type: 'image',
                  attrs: {
                    src: fileReader.result,
                  },
                })
                .focus()
                .run();
            };
          });
        },
      }),
    ],
    content: "",
    contentType: 'markdown', // Enable markdown mode
    editable: editable,
    editorProps: {
      attributes: {
        class: "prose prose-sm sm:prose lg:prose-lg dark:prose-invert max-w-none px-8 pb-8 pt-0 focus:outline-none",
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

  // Add native drop event listeners for debugging
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleDragEnter = (e: DragEvent) => {
      console.log('[Native] dragenter event', e);
      e.preventDefault();
      e.stopPropagation();
    };

    const handleDragOver = (e: DragEvent) => {
      console.log('[Native] dragover event', e);
      e.preventDefault();
      e.stopPropagation();
    };

    const handleDragLeave = (e: DragEvent) => {
      console.log('[Native] dragleave event', e);
    };

    const handleDrop = (e: DragEvent) => {
      console.log('[Native] drop event', e);
      console.log('[Native] drop files:', e.dataTransfer?.files);
      // Don't prevent default - let TipTap handle it
    };

    container.addEventListener('dragenter', handleDragEnter);
    container.addEventListener('dragover', handleDragOver);
    container.addEventListener('dragleave', handleDragLeave);
    container.addEventListener('drop', handleDrop);

    return () => {
      container.removeEventListener('dragenter', handleDragEnter);
      container.removeEventListener('dragover', handleDragOver);
      container.removeEventListener('dragleave', handleDragLeave);
      container.removeEventListener('drop', handleDrop);
    };
  }, []);

  return (
    <div className="w-full h-full overflow-hidden bg-background" ref={containerRef}>
      <ScrollArea className="w-full h-full">
        <EditorContent editor={editor} />
      </ScrollArea>
    </div>
  );
}
