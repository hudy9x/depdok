import React, { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChevronRight, ChevronDown, Hash, PanelRightClose } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from '@/components/ui/button';

// Mirrors the anchor shape provided by @tiptap/extension-table-of-contents
export interface TocAnchor {
  id: string;
  level: number;
  originalLevel: number;
  textContent: string;
  isActive: boolean;
  isScrolledOver: boolean;
  pos: number;
  itemIndex: number;
  dom: HTMLElement;
}

interface TocNode extends TocAnchor {
  children: TocNode[];
}

interface MarkdownOutlineProps {
  anchors: TocAnchor[];
  className?: string;
  onItemClick?: () => void;
}

const buildTree = (anchors: TocAnchor[]): TocNode[] => {
  const root: TocNode[] = [];
  const stack: TocNode[] = [];

  anchors.forEach((anchor) => {
    const node: TocNode = { ...anchor, children: [] };

    while (stack.length > 0 && stack[stack.length - 1].level >= node.level) {
      stack.pop();
    }

    if (stack.length === 0) {
      root.push(node);
    } else {
      stack[stack.length - 1].children.push(node);
    }

    stack.push(node);
  });

  return root;
};

export const MarkdownOutline: React.FC<MarkdownOutlineProps> = ({
  anchors,
  className,
  onItemClick,
}) => {
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());

  const headingTree = useMemo(() => buildTree(anchors), [anchors]);

  const handleHeadingClick = (anchor: TocAnchor) => {
    const element = document.getElementById(anchor.id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (anchor.dom) {
      anchor.dom.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    onItemClick?.();
  };

  const toggleCollapse = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const renderNode = (node: TocNode) => {
    const hasChildren = node.children.length > 0;
    const isCollapsed = collapsedIds.has(node.id);
    const isActive = node.isActive;

    return (
      <div key={node.id} className="flex flex-col">
        <div className={cn(
          "flex items-center gap-1 hover:bg-accent hover:text-accent-foreground rounded-sm px-2 py-1 transition-colors group",
          node.level === 1 && "font-semibold",
          isActive && "bg-primary/20"
        )}>
          {hasChildren ? (
            <button
              onClick={(e) => toggleCollapse(node.id, e)}
              className="h-4 w-4 cursor-pointer shrink-0 hover:bg-muted rounded flex items-center justify-center text-muted-foreground transition-colors"
            >
              {isCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
          ) : (
            <span className="w-4 h-4 shrink-0 flex items-center justify-center text-muted-foreground/50">
              <Hash className="h-3 w-3" />
            </span>
          )}

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => handleHeadingClick(node)}
                  className={`text-left text-xs cursor-pointer truncate w-full flex-1 min-w-0 ${hasChildren ? "" : "opacity-50"}`}
                >
                  {node.textContent || 'Untitled'}
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={10}>
                <p>{node.textContent}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {hasChildren && !isCollapsed && (
          <div className="pl-1 flex flex-col border-l border-border ml-4 my-0.5 w-full">
            {node.children.map(renderNode)}
          </div>
        )}
      </div>
    );
  };

  if (headingTree.length === 0) {
    return (
      <div className={cn("p-4 text-xs text-muted-foreground", className)}>
        No headings found
      </div>
    );
  }

  return (
    <ScrollArea className={cn("h-[calc(100%-300px)] w-48 xl:w-64", className)}>
      <div className="flex flex-col gap-0.5 p-2 w-48 xl:w-64">
        {headingTree.map(renderNode)}
      </div>
    </ScrollArea>
  );
};

export const MarkdownOutlineWrapper: React.FC<{
  anchors: TocAnchor[];
  visible: boolean;
  onToggle: () => void;
}> = ({ anchors, visible, onToggle }) => {
  if (!visible) return null;

  return (
    <div className="w-48 xl:w-64 border-l rounded-tl-md rounded-bl-md border-border bg-muted h-full flex-shrink-0 flex flex-col transition-all duration-300 ease-in-out">
      <div className="p-2 py-1 border-b border-border flex items-center justify-between shrink-0">
        <span className="text-sm font-medium text-muted-foreground pl-2">Outline</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onToggle}
        >
          <PanelRightClose className="h-4 w-4" />
        </Button>
      </div>
      <MarkdownOutline anchors={anchors} className="flex-1" />
    </div>
  );
};
