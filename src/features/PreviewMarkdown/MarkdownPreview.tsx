import { useEffect, useRef, useCallback, useState } from "react";
import { useEditor, EditorContent, ReactNodeViewRenderer } from "@tiptap/react";
import { useAtomValue, useSetAtom } from "jotai";
import { useLocalStorage } from "@/hooks/useLocalStorage";
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

import { MarkdownBubbleMenu } from "./MarkdownBubbleMenu";
import { MarkdownFloatingMenu } from "./MarkdownFloatingMenu";
import { MarkdownDragHandle } from "./MarkdownDragHandle";
import { useLocalLinkHandler } from "./useLocalLinkHandler";
import { useFileHandler } from "./useFileHandler";

import { createTauriImage } from "./TauriImage";
import { CodeBlockNodeView } from "./CodeBlockNodeView";
import { editorStateAtom, markAsDirtyAtom } from "@/stores/EditorStore";
import { draftService } from "@/lib/indexeddb";
import { MarkdownOutlineWrapper, type TocAnchor } from "./MarkdownOutline";
import { TableOfContents } from "@tiptap/extension-table-of-contents";
import { Button } from "@/components/ui/button";
import { PanelRightOpen } from "lucide-react";
import Heading from "@tiptap/extension-heading";
import { HeadingNodeView } from "./HeadingNodeView";
import { LicenseGuard } from "@/components/LicenseGuard";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableNodeView } from "./TableNodeView";
import Highlight from "@tiptap/extension-highlight";
import Link from "@tiptap/extension-link";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import Placeholder from "@tiptap/extension-placeholder";

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
  const [isOutlineOpen, setIsOutlineOpen] = useLocalStorage('markdown-outline-open', false);
  const [tocAnchors, setTocAnchors] = useState<TocAnchor[]>([]);
  // containerRef moved here so it can be referenced in TableOfContents scrollParent
  const containerRef = useRef<HTMLDivElement>(null);
  // handleLinkClick initialised after containerRef below

  const getAssetsFolder = useCallback(
    () => localStorage.getItem('settings-markdown-asset-folder') || '',
    []
  );
  const fileHandler = useFileHandler(editorState.filePath, getAssetsFolder);

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
        heading: false, // Disable default heading
      }),
      CodeBlockLowlight.configure({
        lowlight,
      }).extend({
        addNodeView() {
          return ReactNodeViewRenderer(CodeBlockNodeView);
        },
      }),
      Heading.extend({
        addNodeView() {
          return ReactNodeViewRenderer(HeadingNodeView);
        }
      }),
      Table.configure({
        resizable: false, // Custom node view handles insertion/deletion
      }).extend({
        addNodeView() {
          return ReactNodeViewRenderer(TableNodeView);
        },
      }),
      TableRow,
      TableHeader,
      TableCell,
      Highlight.configure({ multicolor: false }),
      Link.configure({ openOnClick: false, autolink: true }),
      Subscript,
      Superscript,
      Placeholder.configure({
        placeholder: 'Start writing…',
        showOnlyCurrent: false,
      }),
      TableOfContents.configure({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onUpdate: (anchors: any[]) => setTocAnchors(anchors as TocAnchor[]),
        scrollParent: () =>
          (containerRef.current?.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement) ??
          window,
      }),
      Markdown,
      TauriImage,
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      FileHandler.configure(fileHandler),
    ],
    content: "",
    contentType: 'markdown', // Enable markdown mode
    editable: editable,
    autofocus: editable ? 'end' : false,
    editorProps: {
      attributes: {
        class: "prose prose-sm sm:prose lg:prose-lg dark:prose-invert mx-auto max-w-[700px] px-8 pb-8 pt-0 focus:outline-none",
      },
      // Intercept Mod-Enter before StarterKit's HardBreak can consume it.
      // When inside a table cell, exit the table and insert a paragraph below.
      handleKeyDown: (view, event) => {
        if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
          const { state } = view;
          const { $from } = state.selection;

          let tablePos: number | null = null;
          let tableNodeSize = 0;
          for (let depth = $from.depth; depth >= 0; depth--) {
            if ($from.node(depth).type.name === 'table') {
              tablePos = $from.before(depth);
              tableNodeSize = $from.node(depth).nodeSize;
              break;
            }
          }

          if (tablePos === null) return false;

          const insertPos = tablePos + tableNodeSize;
          const paragraph = state.schema.nodes.paragraph.create();
          const baseTr = state.tr.insert(insertPos, paragraph);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const sel = (state.selection.constructor as any).near(baseTr.doc.resolve(insertPos + 1));
          const tr = baseTr.setSelection(sel);
          view.dispatch(tr);
          return true;
        }
        return false;
      },
      // Handle link clicks: open local paths as tabs, open http(s) in browser
      handleClick: (view, pos, event) => handleLinkClick(view, pos, event),
    },
    onUpdate: ({ editor }) => {
      console.log('onUpdate')
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
  const handleLinkClick = useLocalLinkHandler(editorState.filePath, containerRef);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleDragEnter = (e: DragEvent) => {
      console.log('[Native] dragenter event', e.target);
      e.preventDefault();
      e.stopPropagation();
    };

    const handleDragOver = (e: DragEvent) => {
      console.log('[Native] dragover event', e.target);
      e.preventDefault();
      e.stopPropagation();
    };

    const handleDragLeave = (e: DragEvent) => {
      console.log('[Native] dragleave event', e.target);
    };

    const handleDrop = (e: DragEvent) => {
      console.log('[Native] drop event', e.target);
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
    <div className="w-full h-full overflow-hidden bg-background flex" ref={containerRef}>
      <div className="flex-1 h-full relative min-w-0 flex flex-col">
        {!isOutlineOpen && (
          <div className="absolute top-2 right-2 z-10">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 bg-background/80  backdrop-blur-sm"
              onClick={() => setIsOutlineOpen(true)}
            >
              <PanelRightOpen className="h-4 w-4" />
            </Button>
          </div>
        )}

        <ScrollArea className="w-full h-full markdown-editor-scroll">
          {editable && (
            <>
              <MarkdownBubbleMenu editor={editor} />
              <MarkdownFloatingMenu editor={editor} />
              <MarkdownDragHandle editor={editor} />
            </>
          )}
          <EditorContent editor={editor} className="min-h-full" />
        </ScrollArea>
      </div>

      <LicenseGuard className="fixed top-12 right-6" title="" tooltipTitle="Enable Markdown Outline">
        <MarkdownOutlineWrapper
          anchors={tocAnchors}
          visible={isOutlineOpen}
          onToggle={() => setIsOutlineOpen(!isOutlineOpen)}
        />
      </LicenseGuard>
    </div>
  );
}
