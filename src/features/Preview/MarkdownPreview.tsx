import { useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { useAtomValue } from "jotai";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "tiptap-markdown";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { common, createLowlight } from "lowlight";
import "highlight.js/styles/github-dark.css";
import "./markdown.css";

import { createTauriImage } from "./TauriImage";
import { editorStateAtom } from "@/stores/EditorStore";

const lowlight = createLowlight(common);

interface MarkdownPreviewProps {
  content: string;
}

export function MarkdownPreview({ content }: MarkdownPreviewProps) {
  const editorState = useAtomValue(editorStateAtom);
  const TauriImage = createTauriImage(editorState.filePath);

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
    editable: false,
    editorProps: {
      attributes: {
        class: "prose prose-sm sm:prose lg:prose-lg dark:prose-invert max-w-none p-8 focus:outline-none",
      },
    },
  });

  useEffect(() => {
    if (editor) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  return (
    <div className="w-full h-full overflow-auto bg-background">
      <EditorContent editor={editor} />
    </div>
  );
}
