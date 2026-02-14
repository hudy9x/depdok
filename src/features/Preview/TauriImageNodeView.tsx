import { NodeViewWrapper } from '@tiptap/react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { X } from 'lucide-react';
import { useState, useMemo } from 'react';
import { Button } from "@/components/ui/button";

interface TauriImageNodeViewProps {
  node: any;
  updateAttributes: (attrs: any) => void;
  deleteNode: () => void;
  extension: any;
}

export function TauriImageNodeView({ node, deleteNode, extension }: TauriImageNodeViewProps) {
  const [isHovered, setIsHovered] = useState(false);
  const src = node.attrs.src;
  const markdownFilePath = extension.options.markdownFilePath;

  const resolvedSrc = useMemo(() => {
    if (!src) return '';

    // Check if it's a URL or data URI - use as-is
    const isUrl = src.startsWith('http://') ||
      src.startsWith('https://') ||
      src.startsWith('data:');

    if (isUrl) {
      return src;
    }

    // Resolve relative paths to absolute paths
    let resolvedPath = src;
    if (markdownFilePath && (src.startsWith('./') || src.startsWith('../') || !src.startsWith('/'))) {
      const markdownDir = markdownFilePath.substring(0, markdownFilePath.lastIndexOf('/'));

      if (src.startsWith('./')) {
        resolvedPath = `${markdownDir}/${src.substring(2)}`;
      } else if (src.startsWith('../')) {
        let path = src;
        let dir = markdownDir;
        while (path.startsWith('../')) {
          path = path.substring(3);
          const parentSlash = dir.lastIndexOf('/');
          dir = parentSlash >= 0 ? dir.substring(0, parentSlash) : '';
        }
        resolvedPath = `${dir}/${path}`;
      } else if (!src.startsWith('/')) {
        // Relative path without ./ prefix
        resolvedPath = `${markdownDir}/${src}`;
      }
    }

    // Convert local file paths to Tauri asset protocol
    try {
      return convertFileSrc(resolvedPath);
    } catch (error) {
      console.error('[TauriImage] Failed to convert file path:', resolvedPath, error);
      return src;
    }
  }, [src, markdownFilePath]);

  return (
    <NodeViewWrapper className="relative inline-block group">
      <div
        className="relative"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <img
          src={resolvedSrc}
          alt={node.attrs.alt}
          title={node.attrs.title}
          className="rounded-lg max-w-full h-auto"
        />

        {isHovered && (
          <Button
            onClick={deleteNode}
            variant="default"
            size="icon"
            className="absolute top-2 right-2 rounded-md shadow-sm opacity-100"
            title="Delete image"
            type="button"
          >
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>
    </NodeViewWrapper>
  );
}
