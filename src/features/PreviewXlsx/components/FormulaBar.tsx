import React, { useEffect, useRef, useState } from 'react';
import { Check, X, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FormulaBarProps {
  activeCellAddress: string;
  formulaValue: string;
  isEditing: boolean;
  onFormulaChange: (val: string) => void;
  onCommit: () => void;
  onCancel: () => void;
  onJumpToCell?: (address: string) => void;
}

export const FormulaBar: React.FC<FormulaBarProps> = ({
  activeCellAddress,
  formulaValue,
  isEditing,
  onFormulaChange,
  onCommit,
  onCancel,
  onJumpToCell,
}) => {
  const [addressInput, setAddressInput] = useState(activeCellAddress);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setAddressInput(activeCellAddress);
  }, [activeCellAddress]);

  const handleAddressKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
      if (onJumpToCell && addressInput.trim()) {
        onJumpToCell(addressInput.trim().toUpperCase());
      }
    }
  };

  const handleFormulaKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onCommit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  };

  return (
    <div className="flex items-center h-8 bg-background border-b border-border/80 px-2 gap-1.5 text-xs select-none">
      {/* Name box / Cell Address Indicator */}
      <div className="flex items-center bg-muted/40 hover:bg-muted/70 rounded px-1.5 py-0.5 border border-border/60 min-w-[65px] h-6 justify-between transition-colors">
        <input
          type="text"
          value={addressInput}
          onChange={(e) => setAddressInput(e.target.value)}
          onKeyDown={handleAddressKeyDown}
          onBlur={() => setAddressInput(activeCellAddress)}
          className="w-10 font-medium text-foreground bg-transparent outline-none uppercase text-xs"
        />
        <ChevronDown className="w-3 h-3 text-muted-foreground opacity-70 shrink-0" />
      </div>

      {/* Action icons when formula is dirty/editing */}
      {isEditing ? (
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={onCancel}
            title="Cancel"
            className="p-1 hover:bg-destructive/10 text-destructive rounded cursor-pointer transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onCommit}
            title="Commit"
            className="p-1 hover:bg-primary/10 text-primary rounded cursor-pointer transition-colors"
          >
            <Check className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : null}

      {/* fx Icon */}
      <div className="flex items-center text-muted-foreground font-serif italic text-sm font-bold px-1 select-none opacity-80">
        fx
      </div>

      <div className="h-4 w-px bg-border/80 mx-0.5" />

      {/* Formula & Text Input Bar */}
      <div className="flex-1 flex items-center h-6 bg-background rounded px-1.5">
        <input
          ref={inputRef}
          type="text"
          value={formulaValue}
          onChange={(e) => onFormulaChange(e.target.value)}
          onKeyDown={handleFormulaKeyDown}
          placeholder=""
          className={cn(
            'w-full bg-transparent outline-none text-foreground text-xs font-mono',
            formulaValue.startsWith('=') && 'text-blue-600 dark:text-blue-400 font-semibold'
          )}
        />
      </div>
    </div>
  );
};
