import { Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { Bold, Italic, Strikethrough, Code } from "lucide-react";

interface MarkdownBubbleMenuProps {
  editor: Editor | null;
}

export function MarkdownBubbleMenu({ editor }: MarkdownBubbleMenuProps) {
  if (!editor) return null;

  return (
    <BubbleMenu editor={editor} options={{ placement: 'top', offset: 8 }}>
      <div className="flex items-center gap-1 p-1 bg-popover border border-border rounded-lg shadow-lg">
        <button
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`p-2 rounded hover:bg-accent transition-colors ${editor.isActive('bold') ? 'bg-accent text-accent-foreground' : ''
            }`}
          title="Bold"
          type="button"
        >
          <Bold className="w-4 h-4" />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`p-2 rounded hover:bg-accent transition-colors ${editor.isActive('italic') ? 'bg-accent text-accent-foreground' : ''
            }`}
          title="Italic"
          type="button"
        >
          <Italic className="w-4 h-4" />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={`p-2 rounded hover:bg-accent transition-colors ${editor.isActive('strike') ? 'bg-accent text-accent-foreground' : ''
            }`}
          title="Strikethrough"
          type="button"
        >
          <Strikethrough className="w-4 h-4" />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleCode().run()}
          className={`p-2 rounded hover:bg-accent transition-colors ${editor.isActive('code') ? 'bg-accent text-accent-foreground' : ''
            }`}
          title="Code"
          type="button"
        >
          <Code className="w-4 h-4" />
        </button>
      </div>
    </BubbleMenu>
  );
}
