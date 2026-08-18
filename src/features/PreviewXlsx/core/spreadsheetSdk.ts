import {
  CellBorder,
  CellCoordinate,
  CellModel,
  CellStyle,
  CellValue,
  CommandExecutionResult,
  SheetModel,
  SpreadsheetCommand,
  WorkbookModel,
} from './types';
import { FormulaEngine } from './formulaEngine';
import {
  addressToCoordinate,
  coordinateToAddress,
  formatCellValue,
  getCellAddressesInRange,
  parseRangeAddress,
} from './numberFormatter';
import { createEmptyWorkbook, parseXlsxFromData, exportXlsxToBytes, exportXlsxToBase64, exportCsvText } from './xlsxSerializer';

/**
 * Unified Spreadsheet Command Processor & SDK
 * Used by UI interactions, external MCP servers, automated agents, and CLI tools.
 */
export class SpreadsheetSDK {
  /**
   * Loads a workbook from binary Uint8Array, ArrayBuffer, or Base64 string
   */
  public static loadWorkbook(data: Uint8Array | ArrayBuffer | string): WorkbookModel {
    return parseXlsxFromData(data);
  }

  /**
   * Creates a new empty workbook
   */
  public static createWorkbook(initialSheetName = 'Sheet1'): WorkbookModel {
    return createEmptyWorkbook(initialSheetName);
  }

  /**
   * Serializes workbook to binary Uint8Array
   */
  public static toBinary(workbook: WorkbookModel): Uint8Array {
    return exportXlsxToBytes(workbook);
  }

  /**
   * Serializes workbook to Base64 string
   */
  public static toBase64(workbook: WorkbookModel): string {
    return exportXlsxToBase64(workbook);
  }

  /**
   * Serializes workbook to CSV text
   */
  public static toCsv(workbook: WorkbookModel, sheetName?: string): string {
    return exportCsvText(workbook, sheetName);
  }

  /**
   * Recalculates all formulas in the workbook
   */
  public static evaluateAll(workbook: WorkbookModel): WorkbookModel {
    return FormulaEngine.evaluateWorkbook(workbook);
  }

  /**
   * Executes a single command on the workbook and returns the modified workbook
   */
  public static executeCommand(
    workbook: WorkbookModel,
    command: SpreadsheetCommand
  ): { workbook: WorkbookModel; result: CommandExecutionResult } {
    let currentWb = { ...workbook, sheets: { ...workbook.sheets } };
    const modifiedSheets: string[] = [];
    const modifiedCells: string[] = [];

    const targetSheetName = ('sheet' in command && command.sheet) ? command.sheet : (currentWb.activeSheet || currentWb.sheetNames[0]);

    switch (command.type) {
      case 'SET_CELL_VALUE': {
        const sheet = currentWb.sheets[targetSheetName];
        if (!sheet) {
          return {
            workbook: currentWb,
            result: { success: false, message: `Sheet '${targetSheetName}' not found`, modifiedSheets, modifiedCells },
          };
        }

        const upperCell = command.cell.toUpperCase();
        const existing = sheet.cells[upperCell] || { v: null };

        let cellModel: CellModel;
        const valStr = typeof command.value === 'string' ? command.value : null;

        if (valStr && valStr.startsWith('=')) {
          // It's a formula
          const formula = valStr.substring(1).trim();
          cellModel = {
            ...existing,
            f: formula,
            v: null,
          };
        } else {
          // Primitive value
          cellModel = {
            ...existing,
            v: command.value,
            f: undefined, // Clear formula if setting raw value
          };
        }

        const updatedSheet: SheetModel = {
          ...sheet,
          cells: {
            ...sheet.cells,
            [upperCell]: cellModel,
          },
        };

        currentWb.sheets[targetSheetName] = updatedSheet;
        modifiedSheets.push(targetSheetName);
        modifiedCells.push(upperCell);
        break;
      }

      case 'SET_CELL_FORMULA': {
        const sheet = currentWb.sheets[targetSheetName];
        if (!sheet) {
          return {
            workbook: currentWb,
            result: { success: false, message: `Sheet '${targetSheetName}' not found`, modifiedSheets, modifiedCells },
          };
        }

        const upperCell = command.cell.toUpperCase();
        const existing = sheet.cells[upperCell] || { v: null };
        const cleanFormula = command.formula.startsWith('=') ? command.formula.substring(1) : command.formula;

        const updatedSheet: SheetModel = {
          ...sheet,
          cells: {
            ...sheet.cells,
            [upperCell]: {
              ...existing,
              f: cleanFormula,
            },
          },
        };

        currentWb.sheets[targetSheetName] = updatedSheet;
        modifiedSheets.push(targetSheetName);
        modifiedCells.push(upperCell);
        break;
      }

      case 'SET_CELL_STYLE': {
        const sheet = currentWb.sheets[targetSheetName];
        if (!sheet) {
          return {
            workbook: currentWb,
            result: { success: false, message: `Sheet '${targetSheetName}' not found`, modifiedSheets, modifiedCells },
          };
        }

        const range = parseRangeAddress(command.range);
        if (!range) {
          return {
            workbook: currentWb,
            result: { success: false, message: `Invalid range: ${command.range}`, modifiedSheets, modifiedCells },
          };
        }

        const addrs = getCellAddressesInRange(range);
        const updatedCells = { ...sheet.cells };

        for (const addr of addrs) {
          const existing = updatedCells[addr] || { v: null };
          const nextStyle: Record<string, any> = {
            ...(existing.s || {}),
            ...command.style,
          };
          for (const [k, v] of Object.entries(command.style)) {
            if (v === '' || v === null || v === undefined) {
              delete nextStyle[k];
            }
          }
          updatedCells[addr] = {
            ...existing,
            s: Object.keys(nextStyle).length > 0 ? (nextStyle as CellStyle) : undefined,
          };
          modifiedCells.push(addr);
        }

        currentWb.sheets[targetSheetName] = {
          ...sheet,
          cells: updatedCells,
        };
        modifiedSheets.push(targetSheetName);
        break;
      }

      case 'APPLY_BORDER': {
        const sheet = currentWb.sheets[targetSheetName];
        if (!sheet) {
          return {
            workbook: currentWb,
            result: { success: false, message: `Sheet '${targetSheetName}' not found`, modifiedSheets, modifiedCells },
          };
        }

        const range = parseRangeAddress(command.range);
        if (!range) {
          return {
            workbook: currentWb,
            result: { success: false, message: `Invalid range: ${command.range}`, modifiedSheets, modifiedCells },
          };
        }

        const minR = Math.min(range.start.r, range.end.r);
        const maxR = Math.max(range.start.r, range.end.r);
        const minC = Math.min(range.start.c, range.end.c);
        const maxC = Math.max(range.start.c, range.end.c);

        const color = command.color || '#000000';
        const style = command.style || 'thin';
        const edge = { color, style };

        const updatedCells = { ...sheet.cells };

        for (let r = minR; r <= maxR; r++) {
          for (let c = minC; c <= maxC; c++) {
            const addr = coordinateToAddress({ r, c });
            const existing = updatedCells[addr] || { v: null };
            const existingStyle = existing.s || {};
            const existingBorder = existingStyle.border ? { ...existingStyle.border } : {};

            let newBorder: CellBorder | undefined;

            if (command.borderType === 'none') {
              newBorder = undefined;
            } else if (command.borderType === 'all') {
              newBorder = {
                bottom: edge,
                right: edge,
                color,
                style,
              };
              if (r === minR) newBorder.top = edge;
              if (c === minC) newBorder.left = edge;
            } else {
              newBorder = { ...existingBorder, color, style };

              if (command.borderType === 'inner') {
                if (r < maxR) {
                  newBorder.bottom = edge;
                }
                if (r > minR) {
                  delete newBorder.top;
                }
                if (c < maxC) {
                  newBorder.right = edge;
                }
                if (c > minC) {
                  delete newBorder.left;
                }
              } else if (command.borderType === 'horizontal') {
                if (r < maxR) {
                  newBorder.bottom = edge;
                }
                if (r > minR) {
                  delete newBorder.top;
                }
              } else if (command.borderType === 'vertical') {
                if (c < maxC) {
                  newBorder.right = edge;
                }
                if (c > minC) {
                  delete newBorder.left;
                }
              } else if (command.borderType === 'outer') {
                if (r === minR) newBorder.top = edge;
                if (r === maxR) newBorder.bottom = edge;
                if (c === minC) newBorder.left = edge;
                if (c === maxC) newBorder.right = edge;
              } else if (command.borderType === 'left') {
                if (c === minC) newBorder.left = edge;
              } else if (command.borderType === 'top') {
                if (r === minR) newBorder.top = edge;
              } else if (command.borderType === 'right') {
                if (c === maxC) newBorder.right = edge;
              } else if (command.borderType === 'bottom') {
                if (r === maxR) newBorder.bottom = edge;
              }
            }

            const nextStyle = { ...existingStyle };
            if (newBorder === undefined) {
              delete nextStyle.border;
            } else {
              nextStyle.border = newBorder;
            }

            updatedCells[addr] = {
              ...existing,
              s: nextStyle,
            };
            modifiedCells.push(addr);
          }
        }

        currentWb.sheets[targetSheetName] = {
          ...sheet,
          cells: updatedCells,
        };
        modifiedSheets.push(targetSheetName);
        break;
      }

      case 'SET_CELL_FORMAT': {
        const sheet = currentWb.sheets[targetSheetName];
        if (!sheet) {
          return {
            workbook: currentWb,
            result: { success: false, message: `Sheet '${targetSheetName}' not found`, modifiedSheets, modifiedCells },
          };
        }

        const range = parseRangeAddress(command.range);
        if (!range) {
          return {
            workbook: currentWb,
            result: { success: false, message: `Invalid range: ${command.range}`, modifiedSheets, modifiedCells },
          };
        }

        const addrs = getCellAddressesInRange(range);
        const updatedCells = { ...sheet.cells };

        for (const addr of addrs) {
          const existing = updatedCells[addr] || { v: null };
          updatedCells[addr] = {
            ...existing,
            numFmt: command.numFmt,
          };
          modifiedCells.push(addr);
        }

        currentWb.sheets[targetSheetName] = {
          ...sheet,
          cells: updatedCells,
        };
        modifiedSheets.push(targetSheetName);
        break;
      }

      case 'SET_RANGE_DATA': {
        const sheet = currentWb.sheets[targetSheetName];
        if (!sheet) {
          return {
            workbook: currentWb,
            result: { success: false, message: `Sheet '${targetSheetName}' not found`, modifiedSheets, modifiedCells },
          };
        }

        const startCoord = addressToCoordinate(command.startCell);
        if (!startCoord) {
          return {
            workbook: currentWb,
            result: { success: false, message: `Invalid start cell: ${command.startCell}`, modifiedSheets, modifiedCells },
          };
        }

        const updatedCells = { ...sheet.cells };
        const rows = command.data || [];

        for (let r = 0; r < rows.length; r++) {
          const rowData = rows[r];
          if (!Array.isArray(rowData)) continue;
          for (let c = 0; c < rowData.length; c++) {
            const coord: CellCoordinate = { r: startCoord.r + r, c: startCoord.c + c };
            const addr = coordinateToAddress(coord);
            const val = rowData[c];
            const existing = updatedCells[addr] || { v: null };

            if (typeof val === 'string' && val.startsWith('=')) {
              updatedCells[addr] = {
                ...existing,
                f: val.substring(1),
                v: null,
              };
            } else {
              updatedCells[addr] = {
                ...existing,
                v: val,
                f: undefined,
              };
            }
            modifiedCells.push(addr);
          }
        }

        currentWb.sheets[targetSheetName] = {
          ...sheet,
          cells: updatedCells,
          rowCount: Math.max(sheet.rowCount, startCoord.r + rows.length + 5),
        };
        modifiedSheets.push(targetSheetName);
        break;
      }

      case 'CLEAR_RANGE': {
        const sheet = currentWb.sheets[targetSheetName];
        if (!sheet) {
          return {
            workbook: currentWb,
            result: { success: false, message: `Sheet '${targetSheetName}' not found`, modifiedSheets, modifiedCells },
          };
        }

        const range = parseRangeAddress(command.range);
        if (!range) {
          return {
            workbook: currentWb,
            result: { success: false, message: `Invalid range: ${command.range}`, modifiedSheets, modifiedCells },
          };
        }

        const addrs = getCellAddressesInRange(range);
        const updatedCells = { ...sheet.cells };

        for (const addr of addrs) {
          if (command.clearStyles) {
            delete updatedCells[addr];
          } else if (updatedCells[addr]) {
            updatedCells[addr] = {
              ...updatedCells[addr],
              v: null,
              f: undefined,
              calculatedValue: undefined,
              w: '',
            };
          }
          modifiedCells.push(addr);
        }

        currentWb.sheets[targetSheetName] = {
          ...sheet,
          cells: updatedCells,
        };
        modifiedSheets.push(targetSheetName);
        break;
      }

      case 'ADD_SHEET': {
        let count = currentWb.sheetNames.length + 1;
        let newSheetName = command.name || `Sheet${count}`;

        while (currentWb.sheetNames.includes(newSheetName)) {
          count++;
          newSheetName = `Sheet${count}`;
        }

        const newSheet: SheetModel = {
          name: newSheetName,
          cells: {},
          rowCount: 60,
          colCount: 26,
          columnWidths: {},
          rowHeights: {},
        };

        currentWb.sheetNames = [...currentWb.sheetNames, newSheetName];
        currentWb.sheets[newSheetName] = newSheet;
        currentWb.activeSheet = newSheetName;
        modifiedSheets.push(newSheetName);
        break;
      }

      case 'DELETE_SHEET': {
        if (currentWb.sheetNames.length <= 1) {
          return {
            workbook: currentWb,
            result: { success: false, message: 'Cannot delete the only sheet in the workbook', modifiedSheets, modifiedCells },
          };
        }

        const toDelete = command.name;
        if (!currentWb.sheets[toDelete]) {
          return {
            workbook: currentWb,
            result: { success: false, message: `Sheet '${toDelete}' not found`, modifiedSheets, modifiedCells },
          };
        }

        const nextSheetNames = currentWb.sheetNames.filter((n) => n !== toDelete);
        const nextSheets = { ...currentWb.sheets };
        delete nextSheets[toDelete];

        let nextActive = currentWb.activeSheet;
        if (currentWb.activeSheet === toDelete) {
          nextActive = nextSheetNames[0];
        }

        currentWb = {
          ...currentWb,
          sheetNames: nextSheetNames,
          sheets: nextSheets,
          activeSheet: nextActive,
        };
        modifiedSheets.push(toDelete);
        break;
      }

      case 'RENAME_SHEET': {
        const oldName = command.oldName;
        const newName = command.newName?.trim();

        if (!newName || !currentWb.sheets[oldName]) {
          return {
            workbook: currentWb,
            result: { success: false, message: `Invalid sheet rename`, modifiedSheets, modifiedCells },
          };
        }

        if (oldName === newName) {
          return { workbook: currentWb, result: { success: true, modifiedSheets, modifiedCells } };
        }

        if (currentWb.sheetNames.includes(newName)) {
          return {
            workbook: currentWb,
            result: { success: false, message: `Sheet '${newName}' already exists`, modifiedSheets, modifiedCells },
          };
        }

        const nextSheetNames = currentWb.sheetNames.map((n) => (n === oldName ? newName : n));
        const sheetData = currentWb.sheets[oldName];
        const nextSheets = { ...currentWb.sheets };
        delete nextSheets[oldName];
        nextSheets[newName] = { ...sheetData, name: newName };

        currentWb = {
          ...currentWb,
          sheetNames: nextSheetNames,
          sheets: nextSheets,
          activeSheet: currentWb.activeSheet === oldName ? newName : currentWb.activeSheet,
        };
        modifiedSheets.push(newName);
        break;
      }

      case 'SET_ACTIVE_SHEET': {
        if (!currentWb.sheets[command.name]) {
          return {
            workbook: currentWb,
            result: { success: false, message: `Sheet '${command.name}' not found`, modifiedSheets, modifiedCells },
          };
        }
        currentWb.activeSheet = command.name;
        break;
      }

      case 'INSERT_ROW': {
        const sheet = currentWb.sheets[targetSheetName];
        if (!sheet) break;

        const targetRow = command.rowIndex;
        const updatedCells: Record<string, CellModel> = {};

        for (const [addr, cell] of Object.entries(sheet.cells)) {
          const coord = addressToCoordinate(addr);
          if (!coord) continue;
          if (coord.r >= targetRow) {
            const newAddr = coordinateToAddress({ r: coord.r + 1, c: coord.c });
            updatedCells[newAddr] = cell;
          } else {
            updatedCells[addr] = cell;
          }
        }

        currentWb.sheets[targetSheetName] = {
          ...sheet,
          cells: updatedCells,
          rowCount: sheet.rowCount + 1,
        };
        modifiedSheets.push(targetSheetName);
        break;
      }

      case 'DELETE_ROW': {
        const sheet = currentWb.sheets[targetSheetName];
        if (!sheet) break;

        const targetRow = command.rowIndex;
        const updatedCells: Record<string, CellModel> = {};

        for (const [addr, cell] of Object.entries(sheet.cells)) {
          const coord = addressToCoordinate(addr);
          if (!coord) continue;
          if (coord.r === targetRow) {
            // Delete row
            continue;
          } else if (coord.r > targetRow) {
            const newAddr = coordinateToAddress({ r: coord.r - 1, c: coord.c });
            updatedCells[newAddr] = cell;
          } else {
            updatedCells[addr] = cell;
          }
        }

        currentWb.sheets[targetSheetName] = {
          ...sheet,
          cells: updatedCells,
          rowCount: Math.max(sheet.rowCount - 1, 10),
        };
        modifiedSheets.push(targetSheetName);
        break;
      }

      case 'INSERT_COL': {
        const sheet = currentWb.sheets[targetSheetName];
        if (!sheet) break;

        const targetCol = command.colIndex;
        const updatedCells: Record<string, CellModel> = {};

        for (const [addr, cell] of Object.entries(sheet.cells)) {
          const coord = addressToCoordinate(addr);
          if (!coord) continue;
          if (coord.c >= targetCol) {
            const newAddr = coordinateToAddress({ r: coord.r, c: coord.c + 1 });
            updatedCells[newAddr] = cell;
          } else {
            updatedCells[addr] = cell;
          }
        }

        currentWb.sheets[targetSheetName] = {
          ...sheet,
          cells: updatedCells,
          colCount: sheet.colCount + 1,
        };
        modifiedSheets.push(targetSheetName);
        break;
      }

      case 'DELETE_COL': {
        const sheet = currentWb.sheets[targetSheetName];
        if (!sheet) break;

        const targetCol = command.colIndex;
        const updatedCells: Record<string, CellModel> = {};

        for (const [addr, cell] of Object.entries(sheet.cells)) {
          const coord = addressToCoordinate(addr);
          if (!coord) continue;
          if (coord.c === targetCol) {
            continue;
          } else if (coord.c > targetCol) {
            const newAddr = coordinateToAddress({ r: coord.r, c: coord.c - 1 });
            updatedCells[newAddr] = cell;
          } else {
            updatedCells[addr] = cell;
          }
        }

        currentWb.sheets[targetSheetName] = {
          ...sheet,
          cells: updatedCells,
          colCount: Math.max(sheet.colCount - 1, 5),
        };
        modifiedSheets.push(targetSheetName);
        break;
      }

      case 'SET_COL_WIDTH': {
        const sheet = currentWb.sheets[targetSheetName];
        if (!sheet) break;
        currentWb.sheets[targetSheetName] = {
          ...sheet,
          columnWidths: {
            ...(sheet.columnWidths || {}),
            [command.colIndex]: command.width,
          },
        };
        modifiedSheets.push(targetSheetName);
        break;
      }

      case 'SET_ROW_HEIGHT': {
        const sheet = currentWb.sheets[targetSheetName];
        if (!sheet) break;
        currentWb.sheets[targetSheetName] = {
          ...sheet,
          rowHeights: {
            ...(sheet.rowHeights || {}),
            [command.rowIndex]: command.height,
          },
        };
        modifiedSheets.push(targetSheetName);
        break;
      }
    }

    // Recalculate formulas across modified sheets
    const evaluatedWb = FormulaEngine.evaluateWorkbook(currentWb);

    return {
      workbook: evaluatedWb,
      result: {
        success: true,
        modifiedSheets,
        modifiedCells,
      },
    };
  }

  /**
   * Executes a batch of commands sequentially
   */
  public static executeBatch(
    workbook: WorkbookModel,
    commands: SpreadsheetCommand[]
  ): { workbook: WorkbookModel; results: CommandExecutionResult[] } {
    let current = workbook;
    const results: CommandExecutionResult[] = [];

    for (const cmd of commands) {
      const { workbook: nextWb, result } = this.executeCommand(current, cmd);
      current = nextWb;
      results.push(result);
    }

    return { workbook: current, results };
  }

  /**
   * Query cell details
   */
  public static getCellValue(
    workbook: WorkbookModel,
    sheetName: string,
    cellAddress: string
  ): {
    rawValue: CellValue;
    calculatedValue: CellValue;
    formula?: string;
    formattedText: string;
    style?: CellStyle;
    numFmt?: string;
  } {
    const sheet = workbook.sheets[sheetName] || workbook.sheets[workbook.activeSheet];
    if (!sheet) {
      return { rawValue: null, calculatedValue: null, formattedText: '' };
    }

    const cell = sheet.cells[cellAddress.toUpperCase()];
    if (!cell) {
      return { rawValue: null, calculatedValue: null, formattedText: '' };
    }

    const calc = cell.calculatedValue !== undefined ? cell.calculatedValue : cell.v;
    return {
      rawValue: cell.v,
      calculatedValue: calc,
      formula: cell.f ? `=${cell.f}` : undefined,
      formattedText: cell.w || formatCellValue(calc, cell.numFmt),
      style: cell.s,
      numFmt: cell.numFmt,
    };
  }

  /**
   * Query range data as 2D grid
   */
  public static getRangeData(
    workbook: WorkbookModel,
    sheetName: string,
    rangeAddress: string
  ): any[][] {
    const sheet = workbook.sheets[sheetName] || workbook.sheets[workbook.activeSheet];
    if (!sheet) return [];

    const range = parseRangeAddress(rangeAddress);
    if (!range) return [];

    const grid: any[][] = [];
    for (let r = range.start.r; r <= range.end.r; r++) {
      const row: any[] = [];
      for (let c = range.start.c; c <= range.end.c; c++) {
        const addr = coordinateToAddress({ r, c });
        const cell = sheet.cells[addr];
        if (!cell) {
          row.push(null);
        } else {
          row.push(cell.calculatedValue !== undefined ? cell.calculatedValue : cell.v);
        }
      }
      grid.push(row);
    }
    return grid;
  }

  /**
   * Retrieves complete sheet data as an array of JSON objects (header row + rows)
   */
  public static getSheetTable(
    workbook: WorkbookModel,
    sheetName: string
  ): Record<string, any>[] {
    const sheet = workbook.sheets[sheetName] || workbook.sheets[workbook.activeSheet];
    if (!sheet) return [];

    const rows: Record<string, any>[] = [];
    const headers: string[] = [];

    // Find headers from row 0
    for (let c = 0; c < sheet.colCount; c++) {
      const addr = coordinateToAddress({ r: 0, c });
      const cell = sheet.cells[addr];
      if (cell && (cell.v || cell.calculatedValue)) {
        headers[c] = String(cell.calculatedValue || cell.v);
      } else {
        headers[c] = `Column_${c + 1}`;
      }
    }

    for (let r = 1; r < sheet.rowCount; r++) {
      const rowObj: Record<string, any> = {};
      let hasData = false;
      for (let c = 0; c < headers.length; c++) {
        const addr = coordinateToAddress({ r, c });
        const cell = sheet.cells[addr];
        const val = cell ? (cell.calculatedValue !== undefined ? cell.calculatedValue : cell.v) : null;
        if (val !== null && val !== undefined && val !== '') hasData = true;
        rowObj[headers[c]] = val;
      }
      if (hasData) {
        rows.push(rowObj);
      }
    }

    return rows;
  }

  /**
   * Summary overview of all sheets in workbook
   */
  public static getWorkbookSummary(workbook: WorkbookModel): {
    sheets: {
      name: string;
      cellCount: number;
      rowCount: number;
      colCount: number;
      preview: any[][];
    }[];
    activeSheet: string;
  } {
    return {
      activeSheet: workbook.activeSheet,
      sheets: workbook.sheetNames.map((sheetName) => {
        const sheet = workbook.sheets[sheetName];
        const preview = sheet ? this.getRangeData(workbook, sheetName, 'A1:E5') : [];
        return {
          name: sheetName,
          cellCount: sheet ? Object.keys(sheet.cells).length : 0,
          rowCount: sheet ? sheet.rowCount : 0,
          colCount: sheet ? sheet.colCount : 0,
          preview,
        };
      }),
    };
  }
}
