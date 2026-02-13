import { useState } from "react";
import { Editor } from "@tiptap/react";
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  List,
  ListOrdered,
  FileCode,
  Image,
  Trash
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface MenuButtonProps {
  onClick: () => void;
  isActive: boolean;
  title: string;
  icon: React.ReactNode;
}

function MenuButton({ onClick, isActive, title, icon }: MenuButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`p-2 rounded hover:bg-accent transition-colors ${isActive ? 'bg-accent text-accent-foreground' : ''
        }`}
      title={title}
      type="button"
    >
      {icon}
    </button>
  );
}

interface FormatButtonsProps {
  editor: Editor;
}

export function FormatButtons({ editor }: FormatButtonsProps) {
  return (
    <>
      <MenuButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        isActive={editor.isActive('bold')}
        title="Bold"
        icon={<Bold className="w-4 h-4" />}
      />
      <MenuButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        isActive={editor.isActive('italic')}
        title="Italic"
        icon={<Italic className="w-4 h-4" />}
      />
      <MenuButton
        onClick={() => editor.chain().focus().toggleStrike().run()}
        isActive={editor.isActive('strike')}
        title="Strikethrough"
        icon={<Strikethrough className="w-4 h-4" />}
      />
      <MenuButton
        onClick={() => editor.chain().focus().toggleCode().run()}
        isActive={editor.isActive('code')}
        title="Code"
        icon={<Code className="w-4 h-4" />}
      />
    </>
  );
}

export function BlockButtons({ editor }: FormatButtonsProps) {
  const [imagePopoverOpen, setImagePopoverOpen] = useState(false);

  return (
    <>
      <MenuButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        isActive={editor.isActive('heading', { level: 1 })}
        title="Heading 1"
        icon={<Heading1 className="w-4 h-4" />}
      />
      <MenuButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        isActive={editor.isActive('heading', { level: 2 })}
        title="Heading 2"
        icon={<Heading2 className="w-4 h-4" />}
      />
      <MenuButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        isActive={editor.isActive('heading', { level: 3 })}
        title="Heading 3"
        icon={<Heading3 className="w-4 h-4" />}
      />
      <MenuButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()}
        isActive={editor.isActive('heading', { level: 4 })}
        title="Heading 4"
        icon={<Heading4 className="w-4 h-4" />}
      />
      <MenuButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        isActive={editor.isActive('bulletList')}
        title="Bullet List"
        icon={<List className="w-4 h-4" />}
      />
      <MenuButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        isActive={editor.isActive('orderedList')}
        title="Ordered List"
        icon={<ListOrdered className="w-4 h-4" />}
      />
      <MenuButton
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        isActive={editor.isActive('codeBlock')}
        title="Code Block"
        icon={<FileCode className="w-4 h-4" />}
      />
      <Popover open={imagePopoverOpen} onOpenChange={setImagePopoverOpen}>
        <PopoverTrigger asChild>
          <button
            className="p-2 rounded hover:bg-accent transition-colors"
            title="Insert Image"
            type="button"
          >
            <Image className="w-4 h-4" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-64">
          <div className="space-y-2">
            <p className="text-sm font-medium">Insert Image</p>
            <p className="text-xs text-muted-foreground">
              To add an image, copy and paste it or drag and drop it to the cursor position.
            </p>
          </div>
        </PopoverContent>
      </Popover>
      <MenuButton
        onClick={() => {
          const { $from } = editor.state.selection;
          editor.commands.deleteNode($from.parent.type.name);
        }}
        isActive={false}
        title="Delete"
        icon={<Trash className="w-4 h-4" />}
      />
    </>
  );
}
