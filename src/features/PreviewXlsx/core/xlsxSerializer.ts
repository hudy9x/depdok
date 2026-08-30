import ExcelJS from 'exceljs';
import { BorderLineStyle, BorderSide, CellBorder, CellModel, CellStyle, CellType, CellValue, SheetModel, WorkbookModel } from './types';
import { FormulaEngine } from './formulaEngine';
import { parseRangeAddress } from './numberFormatter';

const DEFAULT_ROWS = 60;
const DEFAULT_COLS = 26;

/**
 * Creates an empty WorkbookModel with 1 sheet
 */
export function createEmptyWorkbook(initialSheetName = 'Sheet1'): WorkbookModel {
  const sheet: SheetModel = {
    name: initialSheetName,
    cells: {},
    rowCount: DEFAULT_ROWS,
    colCount: DEFAULT_COLS,
    columnWidths: {},
    rowHeights: {},
  };

  return {
    sheetNames: [initialSheetName],
    sheets: {
      [initialSheetName]: sheet,
    },
    activeSheet: initialSheetName,
  };
}

/**
 * Parses XLSX data (Uint8Array, ArrayBuffer, or base64 string) into WorkbookModel using ExcelJS
 */
export async function parseXlsxFromData(data: Uint8Array | ArrayBuffer | string): Promise<WorkbookModel> {
  try {
    const wb = new ExcelJS.Workbook();
    let buffer: ArrayBuffer | Uint8Array;

    if (typeof data === 'string') {
      buffer = base64ToUint8Array(data);
    } else if (data instanceof Uint8Array) {
      buffer = data;
    } else {
      buffer = new Uint8Array(data);
    }

    await wb.xlsx.load(buffer as any);

    if (!wb.worksheets || wb.worksheets.length === 0) {
      return createEmptyWorkbook();
    }

    const sheetNames: string[] = [];
    const sheets: Record<string, SheetModel> = {};

    wb.eachSheet((worksheet) => {
      const sheetName = worksheet.name || `Sheet${sheetNames.length + 1}`;
      sheetNames.push(sheetName);

      const cells: Record<string, CellModel> = {};
      let maxRow = DEFAULT_ROWS;
      let maxCol = DEFAULT_COLS;

      // Extract cells and styles (including formatted cells with null values)
      worksheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
        if (rowNumber > maxRow) maxRow = Math.max(rowNumber + 10, DEFAULT_ROWS);

        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          if (colNumber > maxCol) maxCol = Math.max(colNumber + 5, DEFAULT_COLS);

          const addr = cell.address.toUpperCase();
          const parsedCell = parseExcelJsCell(cell);
          if (
            parsedCell &&
            (parsedCell.v !== null ||
              parsedCell.f ||
              (parsedCell.s && Object.keys(parsedCell.s).length > 0))
          ) {
            cells[addr] = parsedCell;
          }
        });
      });

      // Column widths
      const columnWidths: Record<number, number> = {};
      if (worksheet.columns) {
        worksheet.columns.forEach((col, idx) => {
          if (col && typeof col.width === 'number' && col.width > 0) {
            columnWidths[idx] = Math.round(col.width * 8);
          }
        });
      }

      // Row heights
      const rowHeights: Record<number, number> = {};
      worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        if (typeof row.height === 'number' && row.height > 0) {
          rowHeights[rowNumber - 1] = Math.round(row.height * 1.33);
        }
      });

      // Merges
      const merges: string[] = [];
      const modelMerges = (worksheet.model as any)?.merges;
      if (Array.isArray(modelMerges)) {
        for (const m of modelMerges) {
          if (typeof m === 'string') {
            merges.push(m.toUpperCase());
          }
        }
      }

      sheets[sheetName] = {
        name: sheetName,
        cells,
        rowCount: Math.max(maxRow, DEFAULT_ROWS),
        colCount: Math.max(maxCol, DEFAULT_COLS),
        columnWidths,
        rowHeights,
        merges,
      };
    });

    const initialWb: WorkbookModel = {
      sheetNames,
      sheets,
      activeSheet: sheetNames[0] || 'Sheet1',
    };

    // Calculate formulas across all sheets
    return FormulaEngine.evaluateWorkbook(initialWb);
  } catch (err) {
    console.error('[XlsxSerializer] Failed to parse XLSX with ExcelJS:', err);
    return createEmptyWorkbook();
  }
}

/**
 * Exports WorkbookModel to binary Uint8Array using ExcelJS
 */
export async function exportXlsxToBytes(workbook: WorkbookModel): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Depdok';
  wb.lastModifiedBy = 'Depdok';
  wb.created = new Date();
  wb.modified = new Date();

  for (const sheetName of workbook.sheetNames) {
    const sheet = workbook.sheets[sheetName];
    if (!sheet) continue;

    const ws = wb.addWorksheet(sheetName, {
      views: [{ showGridLines: true }],
    });

    // Column widths (0-indexed -> 1-indexed)
    if (sheet.columnWidths && Object.keys(sheet.columnWidths).length > 0) {
      for (const [colIdxStr, widthPx] of Object.entries(sheet.columnWidths)) {
        const colIdx = Number(colIdxStr) + 1;
        const col = ws.getColumn(colIdx);
        col.width = Math.max(Math.round(widthPx / 8), 4);
      }
    }

    // Row heights (0-indexed -> 1-indexed)
    if (sheet.rowHeights && Object.keys(sheet.rowHeights).length > 0) {
      for (const [rowIdxStr, heightPx] of Object.entries(sheet.rowHeights)) {
        const rowIdx = Number(rowIdxStr) + 1;
        const row = ws.getRow(rowIdx);
        row.height = Math.max(Math.round(heightPx / 1.33), 12);
      }
    }

    // Populate cells
    for (const [addr, cellModel] of Object.entries(sheet.cells)) {
      const cell = ws.getCell(addr);

      // Value / Formula
      if (cellModel.f) {
        cell.value = {
          formula: cellModel.f,
          result: cellModel.v ?? undefined,
        };
      } else {
        cell.value = cellModel.v as any;
      }

      // Number Format
      if (cellModel.numFmt) {
        cell.numFmt = cellModel.numFmt;
      }

      // Styles
      if (cellModel.s) {
        const s = cellModel.s;

        // Font
        const font = serializeExcelJsFont(s);
        if (font) cell.font = font;

        // Background Color / Fill
        if (s.bgColor) {
          const fill = serializeExcelJsFill(s.bgColor);
          if (fill) cell.fill = fill;
        }

        // Borders
        if (s.border) {
          const border = serializeExcelJsBorder(s.border);
          if (border) cell.border = border;
        }

        // Alignment
        if (s.align || s.valign || s.wrapText) {
          cell.alignment = {
            horizontal: s.align,
            vertical: s.valign,
            wrapText: s.wrapText,
          };
        }
      }
    }

    // Merged Cells
    if (sheet.merges && sheet.merges.length > 0) {
      for (const mergeRange of sheet.merges) {
        try {
          ws.mergeCells(mergeRange);
        } catch (err) {
          console.warn(`[XlsxSerializer] Failed to merge range '${mergeRange}':`, err);
        }
      }
    }
  }

  const buffer = await wb.xlsx.writeBuffer();
  return new Uint8Array(buffer);
}

/**
 * Converts WorkbookModel to Base64 string
 */
export async function exportXlsxToBase64(workbook: WorkbookModel): Promise<string> {
  const bytes = await exportXlsxToBytes(workbook);
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Exports workbook sheet to plain CSV string
 */
export function exportCsvText(workbook: WorkbookModel, sheetName?: string): string {
  const targetSheetName = sheetName || workbook.activeSheet || workbook.sheetNames[0];
  const sheet = workbook.sheets[targetSheetName];
  if (!sheet) return '';

  const rows: Record<number, Record<number, string>> = {};
  let maxR = 0;
  let maxC = 0;

  for (const [addr, cell] of Object.entries(sheet.cells)) {
    const range = parseRangeAddress(addr);
    if (!range) continue;
    const r = range.start.r;
    const c = range.start.c;
    if (r > maxR) maxR = r;
    if (c > maxC) maxC = c;

    if (!rows[r]) rows[r] = {};
    const val = cell.v !== null && cell.v !== undefined ? String(cell.v) : '';
    rows[r][c] = val;
  }

  const lines: string[] = [];
  for (let r = 0; r <= maxR; r++) {
    const rowCells: string[] = [];
    for (let c = 0; c <= maxC; c++) {
      const cellText = rows[r]?.[c] || '';
      if (cellText.includes(',') || cellText.includes('"') || cellText.includes('\n')) {
        rowCells.push(`"${cellText.replace(/"/g, '""')}"`);
      } else {
        rowCells.push(cellText);
      }
    }
    lines.push(rowCells.join(','));
  }

  return lines.join('\n');
}

/**
 * Converts Base64 string to Uint8Array
 */
export function base64ToUint8Array(base64: string): Uint8Array {
  const cleanB64 = base64.startsWith('data:')
    ? base64.substring(base64.indexOf('base64,') + 7)
    : base64;
  const binaryString = atob(cleanB64.trim());
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Internal Helper Functions

function parseExcelJsCell(cell: ExcelJS.Cell): CellModel | null {
  let v: CellValue = null;
  let f: string | undefined = undefined;
  let t: CellType = 's';
  const numFmt: string | undefined = typeof cell.numFmt === 'string' ? cell.numFmt : undefined;

  const rawVal = cell.value;
  if (rawVal !== null && rawVal !== undefined) {
    if (typeof rawVal === 'object') {
      if ('formula' in rawVal) {
        f = (rawVal as any).formula.replace(/^=/, '');
        v = (rawVal as any).result ?? null;
        t = typeof v === 'number' ? 'n' : typeof v === 'boolean' ? 'b' : 's';
      } else if ('sharedFormula' in rawVal) {
        f = (rawVal as any).sharedFormula.replace(/^=/, '');
        v = (rawVal as any).result ?? null;
        t = typeof v === 'number' ? 'n' : typeof v === 'boolean' ? 'b' : 's';
      } else if ('richText' in rawVal && Array.isArray((rawVal as any).richText)) {
        v = (rawVal as any).richText.map((item: any) => item.text || '').join('');
        t = 's';
      } else if ('text' in rawVal) {
        v = (rawVal as any).text;
        t = 's';
      } else if (rawVal instanceof Date) {
        v = rawVal.toISOString();
        t = 'd';
      } else if ('error' in rawVal) {
        v = (rawVal as any).error;
        t = 'e';
      } else {
        v = String(rawVal);
        t = 's';
      }
    } else if (typeof rawVal === 'number') {
      v = rawVal;
      t = 'n';
    } else if (typeof rawVal === 'boolean') {
      v = rawVal;
      t = 'b';
    } else {
      v = String(rawVal);
      t = 's';
    }
  }

  const style = parseExcelJsStyle(cell);

  return {
    v,
    t,
    f,
    numFmt,
    s: style,
  };
}

function parseExcelJsStyle(cell: ExcelJS.Cell): CellStyle | undefined {
  const style: CellStyle = {};

  // 1. Font
  if (cell.font) {
    if (cell.font.bold) style.bold = true;
    if (cell.font.italic) style.italic = true;
    if (cell.font.underline) style.underline = true;
    if (cell.font.strike) style.strike = true;
    if (cell.font.size) style.fontSize = cell.font.size;
    if (cell.font.name) style.fontFamily = cell.font.name;
    const fontColor = argbToHex(cell.font.color);
    if (fontColor) style.color = fontColor;
  }

  // 2. Fill (Background Color)
  if (cell.fill && cell.fill.type === 'pattern') {
    const patternFill = cell.fill as ExcelJS.FillPattern;
    const bg = argbToHex(patternFill.fgColor) || argbToHex(patternFill.bgColor);
    if (bg) style.bgColor = bg;
  }

  // 3. Alignment
  if (cell.alignment) {
    if (cell.alignment.horizontal) {
      style.align = cell.alignment.horizontal as any;
    }
    if (cell.alignment.vertical) {
      const vAlign = cell.alignment.vertical;
      style.valign = vAlign === 'middle' ? 'middle' : vAlign === 'top' ? 'top' : 'bottom';
    }
    if (cell.alignment.wrapText) style.wrapText = true;
  }

  // 4. Borders
  if (cell.border) {
    const border: CellBorder = {};
    const parseSide = (side?: Partial<ExcelJS.Border>): BorderSide | undefined => {
      if (!side || !side.style) return undefined;
      const color = argbToHex(side.color);
      const validStyles: BorderLineStyle[] = ['thin', 'medium', 'thick', 'double', 'dashed', 'dotted'];
      let s: BorderLineStyle = 'thin';
      if (validStyles.includes(side.style as BorderLineStyle)) {
        s = side.style as BorderLineStyle;
      } else if (side.style.includes('dash')) {
        s = 'dashed';
      } else if (side.style.includes('dot') || side.style === 'hair') {
        s = 'dotted';
      }
      return { style: s, color };
    };

    if (cell.border.top) border.top = parseSide(cell.border.top);
    if (cell.border.bottom) border.bottom = parseSide(cell.border.bottom);
    if (cell.border.left) border.left = parseSide(cell.border.left);
    if (cell.border.right) border.right = parseSide(cell.border.right);

    if (Object.keys(border).length > 0) {
      style.border = border;
    }
  }

  return Object.keys(style).length > 0 ? style : undefined;
}

function hexToArgb(hex?: string): string | undefined {
  if (!hex) return undefined;
  let clean = hex.replace(/^#/, '').trim();
  if (clean.length === 3) {
    clean = clean.split('').map((c) => c + c).join('');
  }
  if (clean.length === 6) {
    return `FF${clean.toUpperCase()}`;
  }
  if (clean.length === 8) {
    return clean.toUpperCase();
  }
  return undefined;
}

function argbToHex(color?: any): string | undefined {
  if (!color) return undefined;
  const argbStr = typeof color === 'string' ? color : color.argb;
  if (argbStr && typeof argbStr === 'string') {
    const clean = argbStr.replace(/^#/, '').trim();
    if (clean.length === 8) {
      return `#${clean.substring(2).toUpperCase()}`;
    }
    if (clean.length === 6) {
      return `#${clean.toUpperCase()}`;
    }
  }
  return undefined;
}

function serializeExcelJsFont(style: CellStyle): Partial<ExcelJS.Font> | undefined {
  const font: Partial<ExcelJS.Font> = {};
  let hasFont = false;

  if (style.bold !== undefined) { font.bold = style.bold; hasFont = true; }
  if (style.italic !== undefined) { font.italic = style.italic; hasFont = true; }
  if (style.underline !== undefined) { font.underline = style.underline; hasFont = true; }
  if (style.strike !== undefined) { font.strike = style.strike; hasFont = true; }
  if (style.fontSize !== undefined) { font.size = style.fontSize; hasFont = true; }
  if (style.fontFamily !== undefined) { font.name = style.fontFamily; hasFont = true; }
  if (style.color) {
    const argb = hexToArgb(style.color);
    if (argb) { font.color = { argb }; hasFont = true; }
  }

  return hasFont ? font : undefined;
}

function serializeExcelJsFill(bgColor?: string): ExcelJS.Fill | undefined {
  if (!bgColor) return undefined;
  const argb = hexToArgb(bgColor);
  if (!argb) return undefined;
  return {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb },
  };
}

function serializeExcelJsBorder(border?: CellBorder): Partial<ExcelJS.Borders> | undefined {
  if (!border) return undefined;

  const serializeSide = (side?: BorderSide | boolean): Partial<ExcelJS.Border> | undefined => {
    if (!side) return undefined;
    if (side === true) {
      return {
        style: (border.style || 'thin') as ExcelJS.BorderStyle,
        color: border.color ? { argb: hexToArgb(border.color) } : { argb: 'FF000000' },
      };
    }
    const styleVal = side.style || border.style || 'thin';
    const colorVal = side.color || border.color;
    return {
      style: styleVal as ExcelJS.BorderStyle,
      color: colorVal ? { argb: hexToArgb(colorVal) } : { argb: 'FF000000' },
    };
  };

  const result: Partial<ExcelJS.Borders> = {};
  if (border.top) result.top = serializeSide(border.top);
  if (border.bottom) result.bottom = serializeSide(border.bottom);
  if (border.left) result.left = serializeSide(border.left);
  if (border.right) result.right = serializeSide(border.right);

  return Object.keys(result).length > 0 ? result : undefined;
}
