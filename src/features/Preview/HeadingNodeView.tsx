
import { NodeViewContent, NodeViewWrapper, NodeViewProps } from '@tiptap/react';
import { cn } from '@/lib/utils';
import { useMemo } from 'react';

// Simple slugify function to generate IDs
export const slugify = (text: string) => {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-') // Replace spaces with -
    .replace(/&/g, '-and-') // Replace & with 'and'
    .replace(/[^\w\-]+/g, '') // Remove all non-word chars
    .replace(/\-\-+/g, '-'); // Replace multiple - with single -
};

export const HeadingNodeView = ({ node }: NodeViewProps) => {
  const level = node.attrs.level;
  const text = node.textContent;

  // Generate ID from text content
  const id = useMemo(() => slugify(text), [text]);

  const Tag = `h${level}` as keyof JSX.IntrinsicElements;

  // Get original classes from extension configuration if any (though usually empty for headings default)
  const classes = useMemo(() => {
    const baseClasses = {
      1: "scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl",
      2: "scroll-m-20 border-b border-border border-dashed pb-2 text-3xl font-semibold tracking-tight first:mt-0",
      3: "scroll-m-20 text-2xl font-semibold tracking-tight",
      4: "scroll-m-20 text-xl font-semibold tracking-tight",
      5: "scroll-m-20 text-lg font-semibold tracking-tight",
      6: "scroll-m-20 text-base font-semibold tracking-tight",
    };
    return baseClasses[level as keyof typeof baseClasses] || "";
  }, [level]);

  return (
    <NodeViewWrapper as={Tag} id={id} className={cn(classes, "relative group outline-none")}>
      <NodeViewContent as={"span" as any} />
    </NodeViewWrapper>
  );
};
