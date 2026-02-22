import { useRef, useState } from "react";
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
  Trash,
  Table as TableIcon,
  Highlighter,
  Link,
  Subscript,
  Superscript,
  Unlink,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

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

/** Link popover: set or unset a hyperlink on the selection */
function LinkButton({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const isActive = editor.isActive("link");

  const openPopover = () => {
    const existing = editor.getAttributes("link").href ?? "";
    setUrl(existing);
    setOpen(true);
    // Focus input on next tick after popover renders
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const apply = () => {
    if (url.trim()) {
      editor.chain().focus().setLink({ href: url.trim() }).run();
    } else {
      editor.chain().focus().unsetLink().run();
    }
    setOpen(false);
  };

  const remove = () => {
    editor.chain().focus().unsetLink().run();
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          onClick={openPopover}
          className={`p-2 rounded hover:bg-accent transition-colors ${isActive ? 'bg-accent text-accent-foreground' : ''}`}
          title="Link"
          type="button"
        >
          <Link className="w-4 h-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="start">
        <p className="text-sm font-medium mb-2">Insert / Edit Link</p>
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
            className="h-8 text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); apply(); }
              if (e.key === "Escape") { setOpen(false); }
            }}
          />
          <Button size="sm" className="h-8 px-3" onClick={apply}>
            OK
          </Button>
        </div>
        {isActive && (
          <button
            onClick={remove}
            className="mt-2 flex items-center gap-1 text-xs text-destructive hover:underline"
            type="button"
          >
            <Unlink className="w-3 h-3" /> Remove link
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}

export function FormatButtons({ editor }: FormatButtonsProps) {
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
      <div className="w-[1px] h-4 bg-border mx-1" />
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
      <div className="w-[1px] h-4 bg-border mx-1" />
      <MenuButton
        onClick={() => editor.chain().focus().toggleHighlight().run()}
        isActive={editor.isActive('highlight')}
        title="Highlight"
        icon={<Highlighter className="w-4 h-4" />}
      />
      <MenuButton
        onClick={() => editor.chain().focus().toggleSubscript().run()}
        isActive={editor.isActive('subscript')}
        title="Subscript"
        icon={<Subscript className="w-4 h-4" />}
      />
      <MenuButton
        onClick={() => editor.chain().focus().toggleSuperscript().run()}
        isActive={editor.isActive('superscript')}
        title="Superscript"
        icon={<Superscript className="w-4 h-4" />}
      />
      <LinkButton editor={editor} />
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
      <MenuButton
        onClick={() => editor.chain().focus().insertContent(`
| Heading 1     | Heading 2              |
| ------------- | ---------------------- |
| Content 1     | Content 2              |
        `, { contentType: 'markdown' }).run()}
        isActive={editor.isActive('table')}
        title="Insert Table"
        icon={<TableIcon className="w-4 h-4" />}
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
