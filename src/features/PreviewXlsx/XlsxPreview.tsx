import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CellCoordinate, CellStyle, RangeSelection, SpreadsheetCommand, WorkbookModel } from './core/types';
import { SpreadsheetSDK } from './core/spreadsheetSdk';
import { coordinateToAddress, parseRangeAddress, rangeToAddress } from './core/numberFormatter';
import { Toolbar } from './components/Toolbar';
import { FormulaBar } from './components/FormulaBar';
import { SpreadsheetGrid } from './components/SpreadsheetGrid';
import { SheetTabBar } from './components/SheetTabBar';
import './styles/spreadsheet.css';

interface XlsxPreviewProps {
  content?: string;
  filePath?: string;
  editable?: boolean;
  onContentChange?: (content: string) => void;
}

export const XlsxPreview: React.FC<XlsxPreviewProps> = ({
  content,
  filePath: _filePath,
  editable = true,
  onContentChange,
}) => {
  // Initialize workbook
  const [workbook, setWorkbook] = useState<WorkbookModel>(() => {
    if (content && content.trim()) {
      return SpreadsheetSDK.loadWorkbook(content);
    }
    return SpreadsheetSDK.createWorkbook();
  });

  // Undo / Redo stacks
  const [history, setHistory] = useState<WorkbookModel[]>([]);
  const [future, setFuture] = useState<WorkbookModel[]>([]);

  // Selection & Navigation
  const [activeCell, setActiveCell] = useState<CellCoordinate>({ r: 0, c: 0 });
  const [selection, setSelection] = useState<RangeSelection>({
    start: { r: 0, c: 0 },
    end: { r: 0, c: 0 },
  });

  // Editing state
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');

  // Track changes to emit onContentChange
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastEmittedB64 = useRef<string>(content || '');
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync external content update if different
  useEffect(() => {
    if (!content) return;
    if (content !== lastEmittedB64.current) {
      lastEmittedB64.current = content;
      const parsed = SpreadsheetSDK.loadWorkbook(content);
      setWorkbook(parsed);
    }
  }, [content]);

  // Active sheet
  const activeSheetModel = useMemo(() => {
    return workbook.sheets[workbook.activeSheet] || workbook.sheets[workbook.sheetNames[0]];
  }, [workbook]);

  // Active cell info
  const activeCellAddress = useMemo(() => coordinateToAddress(activeCell), [activeCell]);
  const activeCellModel = useMemo(() => {
    return activeSheetModel?.cells[activeCellAddress];
  }, [activeSheetModel, activeCellAddress]);

  // Display formula value in FormulaBar
  const currentFormulaValue = useMemo(() => {
    if (isEditing) return editValue;
    if (!activeCellModel) return '';
    if (activeCellModel.f) return `=${activeCellModel.f}`;
    return activeCellModel.v !== null && activeCellModel.v !== undefined ? String(activeCellModel.v) : '';
  }, [isEditing, editValue, activeCellModel]);

  // Emit content change when workbook updates
  const emitChange = useCallback(
    (newWb: WorkbookModel) => {
      if (!onContentChange) return;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

      saveTimerRef.current = setTimeout(() => {
        try {
          const b64 = SpreadsheetSDK.toBase64(newWb);
          lastEmittedB64.current = b64;
          onContentChange(b64);
        } catch (err) {
          console.error('[XlsxPreview] Error serializing workbook:', err);
        }
      }, 400);
    },
    [onContentChange]
  );

  // Execute SDK command with history tracking
  const runCommand = useCallback(
    (command: SpreadsheetCommand) => {
      setHistory((prev) => [...prev.slice(-30), workbook]);
      setFuture([]);

      const { workbook: nextWb } = SpreadsheetSDK.executeCommand(workbook, command);
      setWorkbook(nextWb);
      emitChange(nextWb);
    },
    [workbook, emitChange]
  );

  // Undo / Redo
  const handleUndo = useCallback(() => {
    if (history.length === 0) return;
    const previous = history[history.length - 1];
    setHistory((prev) => prev.slice(0, -1));
    setFuture((prev) => [workbook, ...prev]);
    setWorkbook(previous);
    emitChange(previous);
  }, [history, workbook, emitChange]);

  const handleRedo = useCallback(() => {
    if (future.length === 0) return;
    const next = future[0];
    setFuture((prev) => prev.slice(1));
    setHistory((prev) => [...prev, workbook]);
    setWorkbook(next);
    emitChange(next);
  }, [future, workbook, emitChange]);

  // Formula & Cell editing handlers
  const handleStartEdit = useCallback(
    (initialValue?: string) => {
      if (!editable) return;
      setIsEditing(true);

      if (initialValue !== undefined) {
        setEditValue(initialValue);
      } else if (activeCellModel?.f) {
        setEditValue(`=${activeCellModel.f}`);
      } else {
        setEditValue(activeCellModel?.v !== null && activeCellModel?.v !== undefined ? String(activeCellModel.v) : '');
      }
    },
    [editable, activeCellModel]
  );

  const handleCommitEdit = useCallback(
    (direction?: 'down' | 'up' | 'right' | 'left') => {
      if (isEditing) {
        const val = editValue.trim();
        runCommand({
          type: 'SET_CELL_VALUE',
          cell: activeCellAddress,
          value: val,
        });
        setIsEditing(false);
      }

      if (direction === 'down') {
        const nextR = Math.min(activeCell.r + 1, (activeSheetModel?.rowCount || 50) - 1);
        setActiveCell({ r: nextR, c: activeCell.c });
        setSelection({ start: { r: nextR, c: activeCell.c }, end: { r: nextR, c: activeCell.c } });
      } else if (direction === 'up') {
        const nextR = Math.max(activeCell.r - 1, 0);
        setActiveCell({ r: nextR, c: activeCell.c });
        setSelection({ start: { r: nextR, c: activeCell.c }, end: { r: nextR, c: activeCell.c } });
      } else if (direction === 'right') {
        const nextC = Math.min(activeCell.c + 1, (activeSheetModel?.colCount || 26) - 1);
        setActiveCell({ r: activeCell.r, c: nextC });
        setSelection({ start: { r: activeCell.r, c: nextC }, end: { r: activeCell.r, c: nextC } });
      } else if (direction === 'left') {
        const nextC = Math.max(activeCell.c - 1, 0);
        setActiveCell({ r: activeCell.r, c: nextC });
        setSelection({ start: { r: activeCell.r, c: nextC }, end: { r: activeCell.r, c: nextC } });
      }
    },
    [isEditing, editValue, activeCellAddress, activeCell, activeSheetModel, runCommand]
  );

  const handleCancelEdit = useCallback(() => {
    setIsEditing(false);
  }, []);

  const handleFormulaChange = useCallback(
    (val: string) => {
      if (!isEditing) {
        setIsEditing(true);
      }
      setEditValue(val);
    },
    [isEditing]
  );

  // Jump to cell from Name Box
  const handleJumpToCell = useCallback(
    (addr: string) => {
      const coord = parseRangeAddress(addr)?.start;
      if (coord && activeSheetModel) {
        const r = Math.min(coord.r, activeSheetModel.rowCount - 1);
        const c = Math.min(coord.c, activeSheetModel.colCount - 1);
        setActiveCell({ r, c });
        setSelection({ start: { r, c }, end: { r, c } });
      }
    },
    [activeSheetModel]
  );

  // Formatting operations on current selection
  const selectedRangeStr = useMemo(() => rangeToAddress(selection), [selection]);

  const handleApplyStyle = useCallback(
    (style: Partial<CellStyle>) => {
      runCommand({
        type: 'SET_CELL_STYLE',
        range: selectedRangeStr,
        style,
      });
    },
    [runCommand, selectedRangeStr]
  );

  const handleApplyFormat = useCallback(
    (numFmt: string) => {
      runCommand({
        type: 'SET_CELL_FORMAT',
        range: selectedRangeStr,
        numFmt,
      });
    },
    [runCommand, selectedRangeStr]
  );

  const handleClearSelection = useCallback(
    (clearStyles = false) => {
      runCommand({
        type: 'CLEAR_RANGE',
        range: selectedRangeStr,
        clearStyles,
      });
    },
    [runCommand, selectedRangeStr]
  );

  // Row / Col manipulation
  const handleInsertRow = useCallback((rowIndex?: number) => {
    runCommand({ type: 'INSERT_ROW', rowIndex: rowIndex !== undefined ? rowIndex : activeCell.r });
  }, [runCommand, activeCell.r]);

  const handleDeleteRow = useCallback((rowIndex?: number) => {
    runCommand({ type: 'DELETE_ROW', rowIndex: rowIndex !== undefined ? rowIndex : activeCell.r });
  }, [runCommand, activeCell.r]);

  const handleInsertCol = useCallback((colIndex?: number) => {
    runCommand({ type: 'INSERT_COL', colIndex: colIndex !== undefined ? colIndex : activeCell.c });
  }, [runCommand, activeCell.c]);

  const handleDeleteCol = useCallback((colIndex?: number) => {
    runCommand({ type: 'DELETE_COL', colIndex: colIndex !== undefined ? colIndex : activeCell.c });
  }, [runCommand, activeCell.c]);

  const handleClearRangeStr = useCallback((rangeStr: string) => {
    runCommand({ type: 'CLEAR_RANGE', range: rangeStr });
  }, [runCommand]);

  const handlePasteRange = useCallback(async (startCoord: CellCoordinate, options?: { valuesOnly?: boolean }) => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) return;

      const lines = text.split(/\r?\n/).filter((l, idx, arr) => idx < arr.length - 1 || l.length > 0);
      const data2D = lines.map((line) => line.split('\t'));

      if (options?.valuesOnly) {
        const valuesOnlyData = data2D.map(row => row.map(val => val.startsWith('=') ? `'${val}` : val));
        runCommand({
          type: 'SET_RANGE_DATA',
          startCell: coordinateToAddress(startCoord),
          data: valuesOnlyData,
        });
      } else {
        runCommand({
          type: 'SET_RANGE_DATA',
          startCell: coordinateToAddress(startCoord),
          data: data2D,
        });
      }
    } catch (err) {
      console.error('Paste error:', err);
    }
  }, [runCommand]);

  const handleResizeCol = useCallback(
    (colIndex: number, width: number) => {
      runCommand({ type: 'SET_COL_WIDTH', colIndex, width });
    },
    [runCommand]
  );

  const handleResizeRow = useCallback(
    (rowIndex: number, height: number) => {
      runCommand({ type: 'SET_ROW_HEIGHT', rowIndex, height });
    },
    [runCommand]
  );

  // Sheet tab handlers
  const handleSelectSheet = useCallback(
    (name: string) => {
      runCommand({ type: 'SET_ACTIVE_SHEET', name });
      setActiveCell({ r: 0, c: 0 });
      setSelection({ start: { r: 0, c: 0 }, end: { r: 0, c: 0 } });
    },
    [runCommand]
  );

  const handleAddSheet = useCallback(() => {
    runCommand({ type: 'ADD_SHEET' });
  }, [runCommand]);

  const handleRenameSheet = useCallback(
    (oldName: string, newName: string) => {
      runCommand({ type: 'RENAME_SHEET', oldName, newName });
    },
    [runCommand]
  );

  const handleDeleteSheet = useCallback(
    (name: string) => {
      runCommand({ type: 'DELETE_SHEET', name });
    },
    [runCommand]
  );

  // Copy / Paste
  const handleCopy = useCallback(() => {
    if (!activeCellModel) return;
    const val = activeCellModel.f ? `=${activeCellModel.f}` : activeCellModel.v !== null && activeCellModel.v !== undefined ? String(activeCellModel.v) : '';
    navigator.clipboard.writeText(val).catch(console.error);
  }, [activeCellModel]);

  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) return;

      const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
      if (lines.length === 1 && !lines[0].includes('\t')) {
        // Single cell paste
        runCommand({
          type: 'SET_CELL_VALUE',
          cell: activeCellAddress,
          value: lines[0],
        });
      } else {
        // Tab-delimited 2D grid paste
        const grid = lines.map((line) => line.split('\t'));
        runCommand({
          type: 'SET_RANGE_DATA',
          startCell: activeCellAddress,
          data: grid,
        });
      }
    } catch (err) {
      console.error('[XlsxPreview] Paste failed:', err);
    }
  }, [activeCellAddress, runCommand]);

  // Global Keyboard Shortcuts (Undo, Redo, Formatting)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !isEditing) {
        if (e.key === 'z') {
          e.preventDefault();
          if (e.shiftKey) {
            handleRedo();
          } else {
            handleUndo();
          }
        } else if (e.key === 'y') {
          e.preventDefault();
          handleRedo();
        } else if (e.key === 'b') {
          e.preventDefault();
          handleApplyStyle({ bold: !activeCellModel?.s?.bold });
        } else if (e.key === 'i') {
          e.preventDefault();
          handleApplyStyle({ italic: !activeCellModel?.s?.italic });
        } else if (e.key === 'u') {
          e.preventDefault();
          handleApplyStyle({ underline: !activeCellModel?.s?.underline });
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isEditing, handleUndo, handleRedo, handleApplyStyle, activeCellModel]);

  if (!activeSheetModel) {
    return (
      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
        Loading spreadsheet...
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex flex-col w-full h-full bg-background overflow-hidden depdok-spreadsheet select-none"
    >
      {/* Formatting Toolbar */}
      <Toolbar
        canUndo={history.length > 0}
        canRedo={future.length > 0}
        onUndo={handleUndo}
        onRedo={handleRedo}
        activeStyle={activeCellModel?.s}
        activeNumFmt={activeCellModel?.numFmt}
        onApplyStyle={handleApplyStyle}
        onApplyFormat={handleApplyFormat}
      />

      {/* Excel Formula Bar */}
      <FormulaBar
        activeCellAddress={activeCellAddress}
        formulaValue={currentFormulaValue}
        isEditing={isEditing}
        onFormulaChange={handleFormulaChange}
        onCommit={() => handleCommitEdit()}
        onCancel={handleCancelEdit}
        onJumpToCell={handleJumpToCell}
      />

      {/* Spreadsheet Canvas Grid */}
      <div className="flex-1 relative overflow-hidden">
        <SpreadsheetGrid
          sheet={activeSheetModel}
          selection={selection}
          activeCell={activeCell}
          isEditing={isEditing}
          editValue={editValue}
          onSelectRange={(newSelection, newActive) => {
            setSelection(newSelection);
            if (newActive) setActiveCell(newActive);
          }}
          onStartEdit={handleStartEdit}
          onEditChange={setEditValue}
          onCommitEdit={handleCommitEdit}
          onCancelEdit={handleCancelEdit}
          onResizeCol={handleResizeCol}
          onResizeRow={handleResizeRow}
          onInsertCol={handleInsertCol}
          onDeleteCol={handleDeleteCol}
          onInsertRow={handleInsertRow}
          onDeleteRow={handleDeleteRow}
          onClearRange={handleClearRangeStr}
          onPasteRange={handlePasteRange}
          onApplyFormat={handleApplyFormat}
          onApplyStyle={handleApplyStyle}
          onClearSelection={() => handleClearSelection(false)}
          onCopy={handleCopy}
          onPaste={handlePaste}
        />
      </div>

      {/* Bottom Sheet Tabs Bar */}
      <SheetTabBar
        sheetNames={workbook.sheetNames}
        activeSheet={workbook.activeSheet}
        onSelectSheet={handleSelectSheet}
        onAddSheet={handleAddSheet}
        onRenameSheet={handleRenameSheet}
        onDeleteSheet={handleDeleteSheet}
      />
    </div>
  );
};
