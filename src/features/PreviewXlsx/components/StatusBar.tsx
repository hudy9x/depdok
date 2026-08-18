import React from 'react';
import { RangeSelection, SheetModel } from '../core/types';
import { coordinateToAddress, normalizeRange } from '../core/numberFormatter';

interface StatusBarProps {
  sheet?: SheetModel;
  selection: RangeSelection;
}

export const StatusBar: React.FC<StatusBarProps> = ({ sheet, selection }) => {
  const norm = normalizeRange(selection);
  const isMultiCell = norm.start.r !== norm.end.r || norm.start.c !== norm.end.c;

  let sum = 0;
  let count = 0;
  let numericCount = 0;
  let min = Infinity;
  let max = -Infinity;

  if (sheet && isMultiCell) {
    for (let r = norm.start.r; r <= norm.end.r; r++) {
      for (let c = norm.start.c; c <= norm.end.c; c++) {
        const addr = coordinateToAddress({ r, c });
        const cell = sheet.cells[addr];
        if (cell && cell.v !== null && cell.v !== undefined && cell.v !== '') {
          count++;
          const num = typeof cell.calculatedValue === 'number'
            ? cell.calculatedValue
            : typeof cell.v === 'number'
            ? cell.v
            : parseFloat(String(cell.v));

          if (!isNaN(num) && isFinite(num)) {
            numericCount++;
            sum += num;
            if (num < min) min = num;
            if (num > max) max = num;
          }
        }
      }
    }
  }

  const average = numericCount > 0 ? sum / numericCount : 0;

  return (
    <div className="flex items-center justify-between h-6 bg-muted/40 border-t border-border/60 px-3 text-[11px] text-muted-foreground select-none">
      <div className="flex items-center gap-2">
        <span className="text-emerald-600 dark:text-emerald-400 font-medium">Ready</span>
        <span>•</span>
        <span>{sheet?.name || 'Sheet'}</span>
      </div>

      <div className="flex items-center gap-3 font-mono">
        {isMultiCell && count > 0 ? (
          <>
            {numericCount > 0 ? (
              <>
                <span>
                  AVERAGE:{' '}
                  <strong className="text-foreground font-semibold">
                    {Number(average.toFixed(4)).toString()}
                  </strong>
                </span>
                <span>
                  COUNT: <strong className="text-foreground font-semibold">{count}</strong>
                </span>
                <span>
                  SUM:{' '}
                  <strong className="text-foreground font-semibold">
                    {Number(sum.toFixed(4)).toString()}
                  </strong>
                </span>
                <span>
                  MIN:{' '}
                  <strong className="text-foreground font-semibold">{min}</strong>
                </span>
                <span>
                  MAX:{' '}
                  <strong className="text-foreground font-semibold">{max}</strong>
                </span>
              </>
            ) : (
              <span>
                COUNT: <strong className="text-foreground font-semibold">{count}</strong>
              </span>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
};
