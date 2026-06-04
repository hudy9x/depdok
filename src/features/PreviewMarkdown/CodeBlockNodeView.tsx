import { NodeViewContent, NodeViewWrapper } from '@tiptap/react';
import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { NodeViewProps } from '@tiptap/react';
import { MermaidNodeView } from './MermaidNodeView';
import { PlantUMLNodeView } from './PlantUMLNodeView';

export function CodeBlockNodeView(props: NodeViewProps) {
  const { node } = props;
  const [isCopied, setIsCopied] = useState(false);

  const language = node.attrs.language;
  const isMermaid = ['mermaid', 'mmd', 'mindmap'].includes(language);
  const isPlantUML = ['plantuml', 'puml', 'pu'].includes(language);

  if (isMermaid) {
    return <MermaidNodeView {...props} />;
  }

  if (isPlantUML) {
    return <PlantUMLNodeView {...props} />;
  }

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(node.textContent);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  return (
    <NodeViewWrapper className="relative group code-block">
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground"
          onClick={copyToClipboard}
          title="Copy code"
        >
          {isCopied ? (
            <Check className="h-4 w-4 text-green-500" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </Button>
      </div>
      <pre>
        <NodeViewContent />
      </pre>
    </NodeViewWrapper>
  );
}
