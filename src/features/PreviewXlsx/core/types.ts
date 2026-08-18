/**
 * Core type definitions for XLSX spreadsheet engine and SDK.
 */

export type CellValue = string | number | boolean | Date | null;

export type CellType = 's' | 'n' | 'b' | 'd' | 'e' | 'z'; // string, number, boolean, date, error, blank

export type BorderLineStyle = 'thin' | 'medium' | 'thick' | 'double' | 'dashed' | 'dotted';

export interface BorderSide {
  style?: BorderLineStyle;
  color?: string;
}

export interface CellBorder {
  top?: BorderSide | boolean;
  bottom?: BorderSide | boolean;
  left?: BorderSide | boolean;
  right?: BorderSide | boolean;
  color?: string;
  style?: BorderLineStyle;
}

export type BorderType =
  | 'all'
  | 'inner'
  | 'horizontal'
  | 'vertical'
  | 'outer'
  | 'left'
  | 'top'
  | 'right'
  | 'bottom'
  | 'none';

export interface CellStyle {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  color?: string;
  bgColor?: string;
  align?: 'left' | 'center' | 'right';
  valign?: 'top' | 'middle' | 'bottom';
  fontSize?: number;
  fontFamily?: string;
  wrapText?: boolean;
  border?: CellBorder;
}

export interface CellModel {
  /** Raw primitive value */
  v: CellValue;
  /** Cell type */
  t?: CellType;
  /** Formula string without leading '=' (e.g. "SUM(A1:A5)") */
  f?: string;
  /** Formatted display text (e.g. "$1,234.50") */
  w?: string;
  /** Number format pattern (e.g. "$#,##0.00", "0.0%", "YYYY-MM-DD") */
  numFmt?: string;
  /** Visual styles */
  s?: CellStyle;
  /** Evaluated value calculated by formula engine */
  calculatedValue?: CellValue;
  /** Error message if formula evaluation failed */
  error?: string;
}

export interface CellCoordinate {
  /** 0-indexed row number */
  r: number;
  /** 0-indexed column number */
  c: number;
}

export interface RangeSelection {
  start: CellCoordinate;
  end: CellCoordinate;
}

export interface SheetModel {
  name: string;
  /** Map of cell address (e.g. "A1", "C12") to CellModel */
  cells: Record<string, CellModel>;
  /** Total visible rows */
  rowCount: number;
  /** Total visible columns */
  colCount: number;
  /** Custom column widths in pixels (0-indexed column -> width) */
  columnWidths?: Record<number, number>;
  /** Custom row heights in pixels (0-indexed row -> height) */
  rowHeights?: Record<number, number>;
  /** Merged cell ranges e.g. ["A1:B2"] */
  merges?: string[];
  /** Hidden rows */
  hiddenRows?: number[];
  /** Hidden columns */
  hiddenCols?: number[];
}

export interface WorkbookModel {
  sheetNames: string[];
  sheets: Record<string, SheetModel>;
  activeSheet: string;
}

/**
 * Commands for SDK and MCP programmatic manipulation
 */
export type SpreadsheetCommand =
  | { type: 'SET_CELL_VALUE'; sheet?: string; cell: string; value: CellValue }
  | { type: 'SET_CELL_FORMULA'; sheet?: string; cell: string; formula: string }
  | { type: 'SET_CELL_STYLE'; sheet?: string; range: string; style: Partial<CellStyle> }
  | { type: 'APPLY_BORDER'; sheet?: string; range: string; borderType: BorderType; color?: string; style?: BorderLineStyle }
  | { type: 'SET_CELL_FORMAT'; sheet?: string; range: string; numFmt: string }
  | { type: 'SET_RANGE_DATA'; sheet?: string; startCell: string; data: CellValue[][] }
  | { type: 'CLEAR_RANGE'; sheet?: string; range: string; clearStyles?: boolean }
  | { type: 'ADD_SHEET'; name?: string }
  | { type: 'DELETE_SHEET'; name: string }
  | { type: 'DUPLICATE_SHEET'; name: string }
  | { type: 'RENAME_SHEET'; oldName: string; newName: string }
  | { type: 'SET_ACTIVE_SHEET'; name: string }
  | { type: 'INSERT_ROW'; sheet?: string; rowIndex: number }
  | { type: 'DELETE_ROW'; sheet?: string; rowIndex: number }
  | { type: 'INSERT_COL'; sheet?: string; colIndex: number }
  | { type: 'DELETE_COL'; sheet?: string; colIndex: number }
  | { type: 'SET_COL_WIDTH'; sheet?: string; colIndex: number; width: number }
  | { type: 'SET_ROW_HEIGHT'; sheet?: string; rowIndex: number; height: number };

export interface CommandExecutionResult {
  success: boolean;
  message?: string;
  modifiedSheets: string[];
  modifiedCells: string[];
}
