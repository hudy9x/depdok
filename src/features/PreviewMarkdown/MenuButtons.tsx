import { useRef, useState } from "react";
import { Editor, useEditorState } from "@tiptap/react";
import {
  Bold,
  ChevronDown,
  Code,
  FileCode,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Highlighter,
  Image,
  Italic,
  Link,
  List,
  ListOrdered,
  LoaderCircle,
  Strikethrough,
  Subscript,
  Superscript,
  Table as TableIcon,
  Trash,
  Unlink,
} from "lucide-react";
import { RiDoubleQuotesL } from "react-icons/ri";
import { PiMagicWand } from "react-icons/pi";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

import { AdjustTone } from "./ai/AdjustTone";
import { FixSpellingGrammar } from "./ai/FixSpellingGrammar";
import { ExtendText } from "./ai/ExtendText";
import { ReduceText } from "./ai/ReduceText";
import { SimplifyText } from "./ai/SimplifyText";
import { EmojifyText } from "./ai/EmojifyText";
import { CompleteSentence } from "./ai/CompleteSentence";
import { SummarizeText } from "./ai/SummarizeText";
import { TranslateText } from "./ai/TranslateText";

import { TableCellColorPicker } from "./TableCellColorPicker";
import { TableCellMergeButton } from "./TableCellMergeButton";
import { TableCellSplitButton } from "./TableCellSplitButton";

interface MenuButtonProps {
  onClick: () => void;
  isActive: boolean;
  title: string;
  icon: React.ReactNode;
  disabled?: boolean;
}

function MenuButton({ onClick, isActive, title, icon, disabled }: MenuButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`p-2 rounded hover:bg-accent transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
        isActive ? "bg-accent text-accent-foreground font-medium" : "text-muted-foreground hover:text-foreground"
      }`}
      title={title}
      type="button"
    >
      {icon}
    </button>
  );
}

/** Heading dropdown button displaying active heading level icon */
function HeadingDropdown({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false);

  let ActiveIcon = Heading1;

  if (editor.isActive("heading", { level: 1 })) {
    ActiveIcon = Heading1;
  } else if (editor.isActive("heading", { level: 2 })) {
    ActiveIcon = Heading2;
  } else if (editor.isActive("heading", { level: 3 })) {
    ActiveIcon = Heading3;
  } else if (editor.isActive("heading", { level: 4 })) {
    ActiveIcon = Heading4;
  }

  const isHeadingActive = editor.isActive("heading");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onMouseDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
          }}
          className={`flex items-center gap-0.5 p-2 rounded hover:bg-accent transition-colors ${
            isHeadingActive ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
          title="Heading options"
        >
          <ActiveIcon className="w-4 h-4" />
          <ChevronDown className="w-3 h-3 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-36 p-1 flex flex-col gap-0.5 bg-popover/95 backdrop-blur-md border border-border shadow-md"
        onCloseAutoFocus={(e: Event) => e.preventDefault()}
      >
        <button
          type="button"
          onClick={() => {
            editor.chain().focus().toggleHeading({ level: 1 }).run();
            setOpen(false);
          }}
          className={`w-full text-left px-2 py-1.5 text-xs rounded hover:bg-accent flex items-center gap-2 transition-colors ${
            editor.isActive("heading", { level: 1 }) ? "bg-accent font-medium text-accent-foreground" : "text-foreground"
          }`}
        >
          <Heading1 className="w-3.5 h-3.5" />
          <span>Heading 1</span>
        </button>
        <button
          type="button"
          onClick={() => {
            editor.chain().focus().toggleHeading({ level: 2 }).run();
            setOpen(false);
          }}
          className={`w-full text-left px-2 py-1.5 text-xs rounded hover:bg-accent flex items-center gap-2 transition-colors ${
            editor.isActive("heading", { level: 2 }) ? "bg-accent font-medium text-accent-foreground" : "text-foreground"
          }`}
        >
          <Heading2 className="w-3.5 h-3.5" />
          <span>Heading 2</span>
        </button>
        <button
          type="button"
          onClick={() => {
            editor.chain().focus().toggleHeading({ level: 3 }).run();
            setOpen(false);
          }}
          className={`w-full text-left px-2 py-1.5 text-xs rounded hover:bg-accent flex items-center gap-2 transition-colors ${
            editor.isActive("heading", { level: 3 }) ? "bg-accent font-medium text-accent-foreground" : "text-foreground"
          }`}
        >
          <Heading3 className="w-3.5 h-3.5" />
          <span>Heading 3</span>
        </button>
        <button
          type="button"
          onClick={() => {
            editor.chain().focus().toggleHeading({ level: 4 }).run();
            setOpen(false);
          }}
          className={`w-full text-left px-2 py-1.5 text-xs rounded hover:bg-accent flex items-center gap-2 transition-colors ${
            editor.isActive("heading", { level: 4 }) ? "bg-accent font-medium text-accent-foreground" : "text-foreground"
          }`}
        >
          <Heading4 className="w-3.5 h-3.5" />
          <span>Heading 4</span>
        </button>
      </PopoverContent>
    </Popover>
  );
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
          className={`p-2 rounded hover:bg-accent transition-colors ${
            isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
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
              if (e.key === "Enter") {
                e.preventDefault();
                apply();
              }
              if (e.key === "Escape") {
                setOpen(false);
              }
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

/** Unified AI actions popover — click the wand to open */
function AiActionsButton({
  editor,
  onDropdownOpenChange,
}: {
  editor: Editor;
  onDropdownOpenChange?: (open: boolean) => void;
}) {
  const [isAiRunning, setIsAiRunning] = useState(false);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"main" | "tone" | "translate">("main");

  const handleStart = () => {
    setIsAiRunning(true);
    setOpen(false);
    setView("main");
    onDropdownOpenChange?.(false);
  };
  const handleEnd = () => setIsAiRunning(false);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setView("main");
    }
    onDropdownOpenChange?.(nextOpen);
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          disabled={isAiRunning}
          onMouseDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
          }}
          className="p-2 rounded hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-muted-foreground hover:text-foreground flex items-center justify-center"
          title="AI writing actions"
          type="button"
        >
          {isAiRunning ? (
            <LoaderCircle className="w-4 h-4 animate-spin" />
          ) : (
            <PiMagicWand className="w-4 h-4" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-52 p-1.5 flex flex-col gap-0.5"
        onCloseAutoFocus={(e: Event) => e.preventDefault()}
      >
        {view === "main" && (
          <>
            <AdjustTone
              editor={editor}
              mode="trigger"
              onSelectToneMenu={() => setView("tone")}
              onStart={handleStart}
              onEnd={handleEnd}
            />
            <FixSpellingGrammar editor={editor} onStart={handleStart} onEnd={handleEnd} />
            <ExtendText editor={editor} onStart={handleStart} onEnd={handleEnd} />
            <ReduceText editor={editor} onStart={handleStart} onEnd={handleEnd} />
            <SimplifyText editor={editor} onStart={handleStart} onEnd={handleEnd} />
            <EmojifyText editor={editor} onStart={handleStart} onEnd={handleEnd} />
            <div className="h-px bg-border my-1" />
            <CompleteSentence editor={editor} onStart={handleStart} onEnd={handleEnd} />
            <SummarizeText editor={editor} onStart={handleStart} onEnd={handleEnd} />
            <TranslateText
              editor={editor}
              mode="trigger"
              onSelectTranslateMenu={() => setView("translate")}
              onStart={handleStart}
              onEnd={handleEnd}
            />
          </>
        )}

        {view === "tone" && (
          <AdjustTone
            editor={editor}
            mode="menu"
            onBack={() => setView("main")}
            onStart={handleStart}
            onEnd={handleEnd}
          />
        )}

        {view === "translate" && (
          <TranslateText
            editor={editor}
            mode="menu"
            onBack={() => setView("main")}
            onStart={handleStart}
            onEnd={handleEnd}
          />
        )}
      </PopoverContent>
    </Popover>
  );
}

/** Categorized Editor Menu Buttons */
export function CategorizedMenuButtons({ editor }: { editor: Editor }) {
  useEditorState({
    editor,
    selector: (ctx) => ctx.transactionNumber,
  });

  const [imagePopoverOpen, setImagePopoverOpen] = useState(false);
  const isTableActive = editor.isActive("table");

  return (
    <div className="flex items-center gap-0.5 overflow-x-auto max-w-full">
      {/* Category 1: Heading */}
      <HeadingDropdown editor={editor} />

      <div className="w-[1px] h-4 bg-border mx-1 shrink-0" />

      {/* Category 2: Text Formatting (Inline) */}
      <MenuButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        isActive={editor.isActive("bold")}
        title="Bold"
        icon={<Bold className="w-4 h-4" />}
      />
      <MenuButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        isActive={editor.isActive("italic")}
        title="Italic"
        icon={<Italic className="w-4 h-4" />}
      />
      <MenuButton
        onClick={() => editor.chain().focus().toggleStrike().run()}
        isActive={editor.isActive("strike")}
        title="Strikethrough"
        icon={<Strikethrough className="w-4 h-4" />}
      />
      <MenuButton
        onClick={() => editor.chain().focus().toggleCode().run()}
        isActive={editor.isActive("code")}
        title="Code"
        icon={<Code className="w-4 h-4" />}
      />
      <MenuButton
        onClick={() => editor.chain().focus().toggleHighlight().run()}
        isActive={editor.isActive("highlight")}
        title="Highlight"
        icon={<Highlighter className="w-4 h-4" />}
      />
      <MenuButton
        onClick={() => editor.chain().focus().toggleSubscript().run()}
        isActive={editor.isActive("subscript")}
        title="Subscript"
        icon={<Subscript className="w-4 h-4" />}
      />
      <MenuButton
        onClick={() => editor.chain().focus().toggleSuperscript().run()}
        isActive={editor.isActive("superscript")}
        title="Superscript"
        icon={<Superscript className="w-4 h-4" />}
      />

      <div className="w-[1px] h-4 bg-border mx-1 shrink-0" />

      {/* Category 3: Lists & Blocks */}
      <MenuButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        isActive={editor.isActive("bulletList")}
        title="Bullet List"
        icon={<List className="w-4 h-4" />}
      />
      <MenuButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        isActive={editor.isActive("orderedList")}
        title="Ordered List"
        icon={<ListOrdered className="w-4 h-4" />}
      />
      <MenuButton
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        isActive={editor.isActive("blockquote")}
        title="Quote"
        icon={<RiDoubleQuotesL className="w-4 h-4" />}
      />
      <MenuButton
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        isActive={editor.isActive("codeBlock")}
        title="Code Block"
        icon={<FileCode className="w-4 h-4" />}
      />

      <div className="w-[1px] h-4 bg-border mx-1 shrink-0" />

      {/* Category 4: Inserts */}
      <MenuButton
        onClick={() =>
          editor
            .chain()
            .focus()
            .insertContent(
              `
| Heading 1     | Heading 2              |
| ------------- | ---------------------- |
| Content 1     | Content 2              |
        `,
              { contentType: "markdown" }
            )
            .run()
        }
        isActive={editor.isActive("table")}
        title="Insert Table"
        icon={<TableIcon className="w-4 h-4" />}
      />
      <Popover open={imagePopoverOpen} onOpenChange={setImagePopoverOpen}>
        <PopoverTrigger asChild>
          <button
            className="p-2 rounded hover:bg-accent transition-colors text-muted-foreground hover:text-foreground flex items-center justify-center"
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
      <LinkButton editor={editor} />

      <div className="w-[1px] h-4 bg-border mx-1 shrink-0" />

      {/* Category 5: Table Actions (only active when editor.isActive('table') === true) */}
      <TableCellColorPicker editor={editor} disabled={!isTableActive} />
      <TableCellMergeButton editor={editor} disabled={!isTableActive} />
      <TableCellSplitButton editor={editor} disabled={!isTableActive} />

      <div className="w-[1px] h-4 bg-border mx-1 shrink-0" />

      {/* Category 6: AI & Node Actions */}
      <AiActionsButton editor={editor} />
      <MenuButton
        onClick={() => {
          const { $from } = editor.state.selection;
          editor.commands.deleteNode($from.parent.type.name);
        }}
        isActive={false}
        title="Delete Node"
        icon={<Trash className="w-4 h-4" />}
      />
    </div>
  );
}

// Retain BlockButtons export as alias for backward compatibility
export const BlockButtons = CategorizedMenuButtons;
