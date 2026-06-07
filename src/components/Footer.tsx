import { useEffect, useState } from 'react';
import { useAtomValue } from 'jotai';
import { FileCode } from 'lucide-react';

import { activeTabAtom } from '@/stores/TabStore';
import { FooterGitSection } from './FooterGitSection';

export function Footer() {
  const activeTab = useAtomValue(activeTabAtom);
  const [cursorPos, setCursorPos] = useState<{ line: number; col: number } | null>(null);

  // 2. Listen to custom editor cursor events from MonacoEditor
  useEffect(() => {
    const handleCursorChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ lineNumber: number; column: number } | null>;
      if (customEvent.detail) {
        setCursorPos({
          line: customEvent.detail.lineNumber,
          col: customEvent.detail.column
        });
      } else {
        setCursorPos(null);
      }
    };

    window.addEventListener('editor-cursor', handleCursorChange);
    return () => {
      window.removeEventListener('editor-cursor', handleCursorChange);
    };
  }, []);

  const getLanguageLabel = () => {
    if (!activeTab) return '';
    const ext = activeTab.fileExtension?.toLowerCase() || '';
    if (ext === 'md' || ext === 'markdown') return 'Markdown';
    if (ext === 'puml' || ext === 'pu' || ext === 'plantuml') return 'PlantUML';
    return activeTab.fileExtension?.toUpperCase() || 'Text';
  };

  return (
    <footer className="h-7 w-full flex items-center justify-between px-3 border-t border-border/80 bg-layout-chrome text-[11px] text-muted-foreground select-none shrink-0 z-50">
      {/* Left Side: Git Status, Sync, Workspace */}
      <div className="flex items-center gap-2">
        <FooterGitSection />
      </div>

      

      {/* Right Side: Cursor Pos, Language */}
      <div className="flex items-center gap-4">
        {/* Cursor Position Coordinates */}
        {cursorPos && (
          <div className="font-mono text-[10px]">
            Ln {cursorPos.line}, Col {cursorPos.col}
          </div>
        )}

        {/* Cursor Tab indication (VS Code-like static tag) */}
        {activeTab && (
          <div className="flex items-center gap-1.5 bg-muted/30 hover:bg-muted/70 px-1.5 py-0.5 rounded font-mono text-[10px]">
            <span>Tab size: 2</span>
          </div>
        )}

        {/* Content Language Indicator */}
        {activeTab && (
          <div className="flex items-center gap-1 hover:text-foreground hover:bg-muted/50 px-1.5 py-0.5 rounded cursor-default transition-colors">
            <FileCode size={12} className="text-primary" />
            <span className="font-semibold text-foreground/80">{getLanguageLabel()}</span>
          </div>
        )}
      </div>
    </footer>
  );
}
