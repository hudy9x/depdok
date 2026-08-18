import * as XLSX from 'xlsx';
import { CellModel, CellStyle, SheetModel, WorkbookModel } from './types';
import { FormulaEngine } from './formulaEngine';
import { coordinateToAddress } from './numberFormatter';

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
 * Parses XLSX data (Uint8Array, ArrayBuffer, or base64 string) into WorkbookModel
 */
export function parseXlsxFromData(data: Uint8Array | ArrayBuffer | string): WorkbookModel {
  try {
    let readOpts: XLSX.ParsingOptions = {
      type: 'array',
      cellFormula: true,
      cellStyles: true,
      cellNF: true,
      cellDates: true,
    };

    let wb: XLSX.WorkBook;

    if (typeof data === 'string') {
      const isBase64 = data.startsWith('data:') || (/^[A-Za-z0-9+/=\s]+$/.test(data.trim()) && data.length % 4 === 0 && !data.includes('\n'));
      if (isBase64) {
        try {
          const base64Index = data.indexOf('base64,');
          const b64 = base64Index !== -1 ? data.substring(base64Index + 7) : data;
          wb = XLSX.read(b64, { ...readOpts, type: 'base64' });
        } catch {
          wb = XLSX.read(data, { ...readOpts, type: 'string' });
        }
      } else {
        wb = XLSX.read(data, { ...readOpts, type: 'string' });
      }
    } else if (data instanceof Uint8Array) {
      wb = XLSX.read(data, readOpts);
    } else {
      wb = XLSX.read(new Uint8Array(data), readOpts);
    }

    if (!wb.SheetNames || wb.SheetNames.length === 0) {
      return createEmptyWorkbook();
    }

    const sheets: Record<string, SheetModel> = {};

    for (const sheetName of wb.SheetNames) {
      const ws = wb.Sheets[sheetName];
      if (!ws) continue;

      const cells: Record<string, CellModel> = {};
      let maxRow = DEFAULT_ROWS;
      let maxCol = DEFAULT_COLS;

      // Parse range '!ref'
      const range = ws['!ref'] ? XLSX.utils.decode_range(ws['!ref']) : null;
      if (range) {
        maxRow = Math.max(range.e.r + 20, DEFAULT_ROWS);
        maxCol = Math.max(range.e.c + 5, DEFAULT_COLS);
      }

      // Read all cell keys in sheet
      for (const [key, cellData] of Object.entries(ws)) {
        if (key.startsWith('!')) continue; // Skip metadata like '!ref', '!cols'
        const c = cellData as XLSX.CellObject;
        if (!c) continue;

        const cellModel: CellModel = {
          v: c.v !== undefined ? (c.v as any) : null,
          t: c.t as any,
          f: c.f ? c.f.replace(/^=/, '') : undefined,
          w: c.w,
          numFmt: c.z ? String(c.z) : undefined,
          s: parseSheetJsStyle(c.s),
        };

        cells[key.toUpperCase()] = cellModel;
      }

      // Column widths from ws['!cols']
      const columnWidths: Record<number, number> = {};
      if (ws['!cols']) {
        ws['!cols'].forEach((col, idx) => {
          if (col && col.wpx) {
            columnWidths[idx] = col.wpx;
          } else if (col && col.wch) {
            columnWidths[idx] = Math.round(col.wch * 8);
          }
        });
      }

      // Row heights from ws['!rows']
      const rowHeights: Record<number, number> = {};
      if (ws['!rows']) {
        ws['!rows'].forEach((row, idx) => {
          if (row && row.hpx) {
            rowHeights[idx] = row.hpx;
          } else if (row && row.hpt) {
            rowHeights[idx] = Math.round(row.hpt * 1.33);
          }
        });
      }

      // Merges
      const merges: string[] = [];
      if (ws['!merges']) {
        for (const m of ws['!merges']) {
          merges.push(
            `${coordinateToAddress({ r: m.s.r, c: m.s.c })}:${coordinateToAddress({ r: m.e.r, c: m.e.c })}`
          );
        }
      }

      sheets[sheetName] = {
        name: sheetName,
        cells,
        rowCount: maxRow,
        colCount: maxCol,
        columnWidths,
        rowHeights,
        merges,
      };
    }

    const initialWb: WorkbookModel = {
      sheetNames: wb.SheetNames,
      sheets,
      activeSheet: wb.SheetNames[0] || 'Sheet1',
    };

    // Calculate formulas across all sheets
    return FormulaEngine.evaluateWorkbook(initialWb);
  } catch (err) {
    console.error('[XlsxSerializer] Failed to parse XLSX:', err);
    return createEmptyWorkbook();
  }
}

/**
 * Exports WorkbookModel to binary Uint8Array
 */
export function exportXlsxToBytes(workbook: WorkbookModel): Uint8Array {
  const wb = XLSX.utils.book_new();

  for (const sheetName of workbook.sheetNames) {
    const sheet = workbook.sheets[sheetName];
    if (!sheet) continue;

    const ws: XLSX.WorkSheet = {};
    let minR = 0;
    let minC = 0;
    let maxR = 0;
    let maxC = 0;

    for (const [addr, cell] of Object.entries(sheet.cells)) {
      const decoded = XLSX.utils.decode_cell(addr);
      if (decoded.r > maxR) maxR = decoded.r;
      if (decoded.c > maxC) maxC = decoded.c;

      const cellObj: XLSX.CellObject = {
        t: cell.t || (typeof cell.v === 'number' ? 'n' : typeof cell.v === 'boolean' ? 'b' : 's'),
        v: cell.v as any,
      };

      if (cell.f) {
        cellObj.f = cell.f;
      }
      if (cell.numFmt) {
        cellObj.z = cell.numFmt;
      }
      if (cell.s) {
        cellObj.s = serializeSheetJsStyle(cell.s);
      }

      ws[addr] = cellObj;
    }

    // Set range
    ws['!ref'] = XLSX.utils.encode_range({
      s: { r: minR, c: minC },
      e: { r: Math.max(maxR, 20), c: Math.max(maxC, 10) },
    });

    // Column widths
    if (sheet.columnWidths && Object.keys(sheet.columnWidths).length > 0) {
      const cols: XLSX.ColInfo[] = [];
      const colIndices = Object.keys(sheet.columnWidths).map(Number);
      const maxColIdx = Math.max(...colIndices, maxC);
      for (let i = 0; i <= maxColIdx; i++) {
        const wpx = sheet.columnWidths[i];
        cols.push(wpx ? { wpx } : { wch: 10 });
      }
      ws['!cols'] = cols;
    }

    // Row heights
    if (sheet.rowHeights && Object.keys(sheet.rowHeights).length > 0) {
      const rows: XLSX.RowInfo[] = [];
      const rowIndices = Object.keys(sheet.rowHeights).map(Number);
      const maxRowIdx = Math.max(...rowIndices, maxR);
      for (let i = 0; i <= maxRowIdx; i++) {
        const hpx = sheet.rowHeights[i];
        rows.push(hpx ? { hpx } : { hpt: 18 });
      }
      ws['!rows'] = rows;
    }

    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  }

  const out = XLSX.write(wb, {
    bookType: 'xlsx',
    type: 'array',
    cellStyles: true,
  });

  return new Uint8Array(out);
}

/**
 * Exports workbook sheet to plain CSV string
 */
export function exportCsvText(workbook: WorkbookModel, sheetName?: string): string {
  const targetSheetName = sheetName || workbook.activeSheet || workbook.sheetNames[0];
  const sheet = workbook.sheets[targetSheetName];
  if (!sheet) return '';

  const ws: XLSX.WorkSheet = {};
  let minR = 0;
  let minC = 0;
  let maxR = 0;
  let maxC = 0;

  for (const [addr, cell] of Object.entries(sheet.cells)) {
    const decoded = XLSX.utils.decode_cell(addr);
    if (decoded.r > maxR) maxR = decoded.r;
    if (decoded.c > maxC) maxC = decoded.c;

    const cellObj: XLSX.CellObject = {
      t: cell.t || (typeof cell.v === 'number' ? 'n' : typeof cell.v === 'boolean' ? 'b' : 's'),
      v: cell.v as any,
    };
    if (cell.f) cellObj.f = cell.f;
    if (cell.numFmt) cellObj.z = cell.numFmt;
    ws[addr] = cellObj;
  }

  ws['!ref'] = XLSX.utils.encode_range({
    s: { r: minR, c: minC },
    e: { r: Math.max(maxR, 0), c: Math.max(maxC, 0) },
  });

  return XLSX.utils.sheet_to_csv(ws);
}

/**
 * Converts WorkbookModel to Base64 string
 */
export function exportXlsxToBase64(workbook: WorkbookModel): string {
  const bytes = exportXlsxToBytes(workbook);
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Converts Base64 string to Uint8Array
 */
export function base64ToUint8Array(base64: string): Uint8Array {
  const cleanB64 = base64.startsWith('data:')
    ? base64.substring(base64.indexOf('base64,') + 7)
    : base64;
  const binaryString = atob(cleanB64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Style conversion helpers
function parseSheetJsStyle(s: any): CellStyle | undefined {
  if (!s || typeof s !== 'object') return undefined;

  const style: CellStyle = {};
  if (s.font) {
    if (s.font.bold) style.bold = true;
    if (s.font.italic) style.italic = true;
    if (s.font.underline) style.underline = true;
    if (s.font.strike) style.strike = true;
    if (s.font.color && s.font.color.rgb) style.color = `#${s.font.color.rgb}`;
    if (s.font.sz) style.fontSize = s.font.sz;
    if (s.font.name) style.fontFamily = s.font.name;
  }

  if (s.fill && s.fill.fgColor && s.fill.fgColor.rgb) {
    style.bgColor = `#${s.fill.fgColor.rgb}`;
  }

  if (s.alignment) {
    if (s.alignment.horizontal) style.align = s.alignment.horizontal;
    if (s.alignment.vertical) style.valign = s.alignment.vertical;
    if (s.alignment.wrapText) style.wrapText = true;
  }

  return Object.keys(style).length > 0 ? style : undefined;
}

function serializeSheetJsStyle(style: CellStyle): any {
  const s: any = {};

  if (style.bold || style.italic || style.underline || style.strike || style.color || style.fontSize || style.fontFamily) {
    s.font = {};
    if (style.bold) s.font.bold = true;
    if (style.italic) s.font.italic = true;
    if (style.underline) s.font.underline = true;
    if (style.strike) s.font.strike = true;
    if (style.fontSize) s.font.sz = style.fontSize;
    if (style.fontFamily) s.font.name = style.fontFamily;
    if (style.color) {
      s.font.color = { rgb: style.color.replace(/^#/, '') };
    }
  }

  if (style.bgColor) {
    s.fill = {
      fgColor: { rgb: style.bgColor.replace(/^#/, '') },
    };
  }

  if (style.align || style.valign || style.wrapText) {
    s.alignment = {};
    if (style.align) s.alignment.horizontal = style.align;
    if (style.valign) s.alignment.vertical = style.valign;
    if (style.wrapText) s.alignment.wrapText = true;
  }

  return s;
}
