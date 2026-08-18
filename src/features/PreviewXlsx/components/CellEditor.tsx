import React, { useEffect, useRef } from 'react';
import { CellStyle } from '../core/types';

interface CellEditorProps {
  initialValue: string;
  position: { top: number; left: number; width: number; height: number };
  style?: CellStyle;
  onChange: (val: string) => void;
  onCommit: (direction?: 'down' | 'up' | 'right' | 'left') => void;
  onCancel: () => void;
}

export const CellEditor: React.FC<CellEditorProps> = ({
  initialValue,
  position,
  style = {},
  onChange,
  onCommit,
  onCancel,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      // Position cursor at the end
      const len = inputRef.current.value.length;
      inputRef.current.setSelectionRange(len, len);
    }
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onCommit(e.shiftKey ? 'up' : 'down');
    } else if (e.key === 'Tab') {
      e.preventDefault();
      onCommit(e.shiftKey ? 'left' : 'right');
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  };

  return (
    <div
      className="absolute z-30 bg-background shadow-md border-2 border-primary overflow-hidden"
      style={{
        top: `${position.top - 1}px`,
        left: `${position.left - 1}px`,
        minWidth: `${position.width + 2}px`,
        height: `${position.height + 2}px`,
      }}
    >
      <input
        ref={inputRef}
        type="text"
        value={initialValue}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => onCommit()}
        className="w-full h-full px-1 py-0 border-none outline-none bg-background text-foreground text-xs leading-none"
        style={{
          fontWeight: style.bold ? 'bold' : 'normal',
          fontStyle: style.italic ? 'italic' : 'normal',
          textDecoration: style.underline ? 'underline' : style.strike ? 'line-through' : 'none',
          textAlign: style.align || 'left',
          color: style.color || 'inherit',
          fontSize: style.fontSize ? `${style.fontSize}px` : '12px',
          fontFamily: style.fontFamily || 'inherit',
        }}
      />
    </div>
  );
};
