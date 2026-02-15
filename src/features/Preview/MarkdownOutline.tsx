
import React, { useEffect, useState } from 'react';
import { Editor } from '@tiptap/react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { slugify } from './HeadingNodeView';

interface MarkdownOutlineProps {
  editor: Editor | null;
  className?: string;
  onItemClick?: () => void;
}

interface HeadingItem {
  id: string;
  text: string;
  level: number;
  pos: number;
}

export const MarkdownOutline: React.FC<MarkdownOutlineProps> = ({
  editor,
  className,
  onItemClick,
}) => {
  const [headings, setHeadings] = useState<HeadingItem[]>([]);

  useEffect(() => {
    if (!editor) return;

    const updateHeadings = () => {
      const items: HeadingItem[] = [];
      const { doc } = editor.state;

      doc.descendants((node, pos) => {
        if (node.type.name === 'heading') {
          // Only capture H1-H4 as requested
          if (node.attrs.level <= 4) {
            items.push({
              id: slugify(node.textContent),
              text: node.textContent,
              level: node.attrs.level,
              pos: pos,
            });
          }
        }
      });

      setHeadings(items);
    };

    // Initial update
    updateHeadings();

    // Subscribe to editor updates
    const handleUpdate = () => {
      updateHeadings();
    };

    editor.on('update', handleUpdate);

    // Cleanup
    return () => {
      editor.off('update', handleUpdate);
    };
  }, [editor]);

  const handleHeadingClick = (id: string, pos: number) => {
    if (!editor) return;

    // Improved scroll logic
    // editor.chain().focus().setTextSelection(pos).run();

    const element = document.getElementById(id);
    console.log("element", element)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      // Fallback to DOM lookup if ID not found (e.g. if slug generation differs or immediate render issue)
      const dom = editor.view.nodeDOM(pos) as HTMLElement;
      if (dom?.scrollIntoView) {
        dom.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }

    if (onItemClick) {
      onItemClick();
    }
  };

  if (headings.length === 0) {
    return (
      <div className={cn("p-4 text-xs text-muted-foreground", className)}>
        No headings found
      </div>
    );
  }

  return (
    <ScrollArea className={cn("h-full", className)}>
      <div className="flex flex-col gap-1 p-2">
        {headings.map((heading) => (
          <button
            key={heading.id}
            onClick={() => handleHeadingClick(heading.id, heading.pos)}
            className={cn(
              "text-left text-xs hover:bg-accent hover:text-accent-foreground px-2 py-1 rounded-sm transition-colors w-full block truncate",
              heading.level === 1 && "font-bold",
              heading.level === 2 && "pl-4",
              heading.level === 3 && "pl-8 text-muted-foreground",
              heading.level === 4 && "pl-12 text-muted-foreground/80",
            )}
            title={heading.text}
          >
            {heading.text || 'Untitled'}
          </button>
        ))}
      </div>
    </ScrollArea>
  );
};
