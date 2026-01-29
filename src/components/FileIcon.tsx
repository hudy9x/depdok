import { FileText, CheckSquare, Image, Code } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FileIconProps {
  filename: string;
  className?: string;
}

export function FileIcon({ filename, className }: FileIconProps) {
  const getIcon = () => {
    if (filename.endsWith('.todo')) return <CheckSquare className={cn("w-3 h-3 text-blue-500", className)} />;
    if (filename.endsWith('.md')) return <FileText className={cn("w-3 h-3 text-yellow-500", className)} />;
    if (filename.endsWith('.mmd')) return <Image className={cn("w-3 h-3 text-purple-500", className)} />;
    if (filename.endsWith('.plantuml') || filename.endsWith('.puml') || filename.endsWith('.pu')) return <Code className={cn("w-3 h-3 text-green-500", className)} />;
    return <FileText className={cn("w-3 h-3 text-muted-foreground", className)} />;
  };

  return getIcon();
}
