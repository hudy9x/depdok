import { Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { LoaderCircle } from "lucide-react";
import { PiMagicWand } from "react-icons/pi";
import { FormatButtons } from "./MenuButtons";
import { useGrammarCorrect } from "@/features/LLMChat/hooks/useGrammarCorrect";

interface MarkdownBubbleMenuProps {
  editor: Editor | null;
}

const BUBBLE_MENU_OPTIONS = { placement: 'top' as const, offset: 8 };

export function MarkdownBubbleMenu({ editor }: MarkdownBubbleMenuProps) {
  const { correct, isCorrecting } = useGrammarCorrect(editor);

  if (!editor) return null;

  return (
    <BubbleMenu editor={editor} options={BUBBLE_MENU_OPTIONS}>
      <div className="flex items-center gap-1 p-1 bg-popover border border-border rounded-lg shadow-lg">
        <FormatButtons editor={editor} />
        <div className="w-px h-4 bg-border/60 mx-0.5" />
        <button
          type="button"
          onClick={correct}
          disabled={isCorrecting}
          title="Fix grammar with AI"
          className="flex items-center justify-center h-7 w-7 rounded-md hover:bg-muted transition-colors cursor-pointer text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isCorrecting ? (
            <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <PiMagicWand className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
    </BubbleMenu>
  );
}
