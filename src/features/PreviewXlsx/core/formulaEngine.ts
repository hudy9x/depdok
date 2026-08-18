import { CellValue, SheetModel, WorkbookModel } from './types';
import { addressToCoordinate, parseRangeAddress, formatCellValue } from './numberFormatter';

type FunctionHandler = (args: any[], context: EvaluationContext) => any;

interface EvaluationContext {
  workbook: WorkbookModel;
  currentSheet: SheetModel;
  currentCell: string;
  evaluatingStack: Set<string>;
}

/**
 * Formula calculation engine
 */
export class FormulaEngine {
  public static functions: Record<string, FunctionHandler> = {
    SUM: (args) => {
      const flat = flattenNumbers(args);
      return flat.reduce((acc, val) => acc + val, 0);
    },
    AVERAGE: (args) => {
      const flat = flattenNumbers(args);
      if (flat.length === 0) return '#DIV/0!';
      return flat.reduce((acc, val) => acc + val, 0) / flat.length;
    },
    COUNT: (args) => {
      const flat = flattenNumbers(args);
      return flat.length;
    },
    COUNTA: (args) => {
      const flat = flattenAll(args);
      return flat.filter((v) => v !== null && v !== undefined && v !== '').length;
    },
    MIN: (args) => {
      const flat = flattenNumbers(args);
      if (flat.length === 0) return 0;
      return Math.min(...flat);
    },
    MAX: (args) => {
      const flat = flattenNumbers(args);
      if (flat.length === 0) return 0;
      return Math.max(...flat);
    },
    PRODUCT: (args) => {
      const flat = flattenNumbers(args);
      if (flat.length === 0) return 0;
      return flat.reduce((acc, val) => acc * val, 1);
    },
    ABS: (args) => {
      const val = toNumber(args[0]);
      return Math.abs(val);
    },
    ROUND: (args) => {
      const num = toNumber(args[0]);
      const digits = args[1] !== undefined ? toNumber(args[1]) : 0;
      const factor = Math.pow(10, digits);
      return Math.round(num * factor) / factor;
    },
    ROUNDUP: (args) => {
      const num = toNumber(args[0]);
      const digits = args[1] !== undefined ? toNumber(args[1]) : 0;
      const factor = Math.pow(10, digits);
      return Math.ceil(num * factor) / factor;
    },
    ROUNDDOWN: (args) => {
      const num = toNumber(args[0]);
      const digits = args[1] !== undefined ? toNumber(args[1]) : 0;
      const factor = Math.pow(10, digits);
      return Math.floor(num * factor) / factor;
    },
    SQRT: (args) => {
      const val = toNumber(args[0]);
      if (val < 0) return '#NUM!';
      return Math.sqrt(val);
    },
    POWER: (args) => {
      const base = toNumber(args[0]);
      const exp = toNumber(args[1]);
      return Math.pow(base, exp);
    },
    MOD: (args) => {
      const n = toNumber(args[0]);
      const d = toNumber(args[1]);
      if (d === 0) return '#DIV/0!';
      return n % d;
    },
    INT: (args) => {
      return Math.floor(toNumber(args[0]));
    },
    MEDIAN: (args) => {
      const flat = flattenNumbers(args).sort((a, b) => a - b);
      if (flat.length === 0) return '#NUM!';
      const mid = Math.floor(flat.length / 2);
      return flat.length % 2 !== 0 ? flat[mid] : (flat[mid - 1] + flat[mid]) / 2;
    },
    IF: (args) => {
      const condition = toBoolean(args[0]);
      return condition ? args[1] : (args[2] !== undefined ? args[2] : false);
    },
    IFS: (args) => {
      for (let i = 0; i < args.length; i += 2) {
        if (toBoolean(args[i])) {
          return args[i + 1];
        }
      }
      return '#N/A';
    },
    AND: (args) => {
      const flat = flattenAll(args);
      if (flat.length === 0) return '#VALUE!';
      return flat.every(toBoolean);
    },
    OR: (args) => {
      const flat = flattenAll(args);
      if (flat.length === 0) return '#VALUE!';
      return flat.some(toBoolean);
    },
    NOT: (args) => {
      return !toBoolean(args[0]);
    },
    IFERROR: (args) => {
      const val = args[0];
      if (isError(val)) return args[1] !== undefined ? args[1] : '';
      return val;
    },
    CONCATENATE: (args) => {
      const flat = flattenAll(args);
      return flat.map((v) => (v === null || v === undefined ? '' : String(v))).join('');
    },
    CONCAT: (args) => {
      const flat = flattenAll(args);
      return flat.map((v) => (v === null || v === undefined ? '' : String(v))).join('');
    },
    LEFT: (args) => {
      const str = String(args[0] || '');
      const count = args[1] !== undefined ? toNumber(args[1]) : 1;
      return str.slice(0, count);
    },
    RIGHT: (args) => {
      const str = String(args[0] || '');
      const count = args[1] !== undefined ? toNumber(args[1]) : 1;
      return str.slice(-count);
    },
    MID: (args) => {
      const str = String(args[0] || '');
      const start = toNumber(args[1]) - 1;
      const count = toNumber(args[2]);
      return str.substring(start, start + count);
    },
    LEN: (args) => {
      return String(args[0] || '').length;
    },
    UPPER: (args) => {
      return String(args[0] || '').toUpperCase();
    },
    LOWER: (args) => {
      return String(args[0] || '').toLowerCase();
    },
    PROPER: (args) => {
      const str = String(args[0] || '');
      return str.replace(/\b\w/g, (c) => c.toUpperCase());
    },
    TRIM: (args) => {
      return String(args[0] || '').trim().replace(/\s+/g, ' ');
    },
    TEXT: (args) => {
      const val = args[0];
      const fmt = String(args[1] || 'General');
      return formatCellValue(val, fmt);
    },
    EXACT: (args) => {
      return String(args[0] || '') === String(args[1] || '');
    },
    REPLACE: (args) => {
      const oldText = String(args[0] || '');
      const start = toNumber(args[1]) - 1;
      const count = toNumber(args[2]);
      const newText = String(args[3] || '');
      return oldText.slice(0, start) + newText + oldText.slice(start + count);
    },
    SUBSTITUTE: (args) => {
      const text = String(args[0] || '');
      const oldSub = String(args[1] || '');
      const newSub = String(args[2] || '');
      return text.split(oldSub).join(newSub);
    },
    TODAY: () => {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    },
    NOW: () => {
      const d = new Date();
      return d.toISOString().replace('T', ' ').substring(0, 19);
    },
    DATE: (args) => {
      const y = toNumber(args[0]);
      const m = toNumber(args[1]) - 1;
      const d = toNumber(args[2]);
      const date = new Date(y, m, d);
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    },
    YEAR: (args) => {
      const d = parseDateValue(args[0]);
      return d ? d.getFullYear() : '#VALUE!';
    },
    MONTH: (args) => {
      const d = parseDateValue(args[0]);
      return d ? d.getMonth() + 1 : '#VALUE!';
    },
    DAY: (args) => {
      const d = parseDateValue(args[0]);
      return d ? d.getDate() : '#VALUE!';
    },
    VLOOKUP: (args) => {
      const lookupVal = args[0];
      const tableData = args[1]; // Should be array of rows
      const colIndex = toNumber(args[2]) - 1;
      const exactMatch = args[3] !== undefined ? !toBoolean(args[3]) : true;

      if (!Array.isArray(tableData) || colIndex < 0) return '#REF!';

      for (let r = 0; r < tableData.length; r++) {
        const row = tableData[r];
        if (!Array.isArray(row)) continue;
        const firstCol = row[0];
        const match = exactMatch
          ? String(firstCol).toLowerCase() === String(lookupVal).toLowerCase()
          : String(firstCol).toLowerCase() <= String(lookupVal).toLowerCase();

        if (match) {
          return row[colIndex] !== undefined ? row[colIndex] : '#N/A';
        }
      }
      return '#N/A';
    },
    INDEX: (args) => {
      const array = args[0];
      const rowNum = toNumber(args[1]) - 1;
      const colNum = args[2] !== undefined ? toNumber(args[2]) - 1 : 0;
      if (Array.isArray(array)) {
        if (Array.isArray(array[rowNum])) {
          return array[rowNum][colNum] !== undefined ? array[rowNum][colNum] : '#REF!';
        }
        return array[rowNum] !== undefined ? array[rowNum] : '#REF!';
      }
      return array;
    },
    MATCH: (args) => {
      const lookupVal = args[0];
      const flat = flattenAll(args[1]);
      for (let i = 0; i < flat.length; i++) {
        if (String(flat[i]).toLowerCase() === String(lookupVal).toLowerCase()) {
          return i + 1; // 1-indexed
        }
      }
      return '#N/A';
    },
  };

  /**
   * Evaluate a formula string (e.g. "SUM(A1:A5) + B2 * 10")
   */
  public static evaluateFormula(
    formula: string,
    workbook: WorkbookModel,
    sheetName: string,
    cellAddress: string,
    evaluatingStack: Set<string> = new Set()
  ): CellValue {
    const rawFormula = formula.startsWith('=') ? formula.substring(1).trim() : formula.trim();
    if (!rawFormula) return '';

    const sheet = workbook.sheets[sheetName];
    if (!sheet) return '#REF!';

    const cellKey = `${sheetName}!${cellAddress.toUpperCase()}`;
    if (evaluatingStack.has(cellKey)) {
      return '#CIRCULAR!';
    }

    evaluatingStack.add(cellKey);

    const context: EvaluationContext = {
      workbook,
      currentSheet: sheet,
      currentCell: cellAddress,
      evaluatingStack,
    };

    try {
      const result = this.parseAndEvaluate(rawFormula, context);
      evaluatingStack.delete(cellKey);
      return result;
    } catch (err: any) {
      evaluatingStack.delete(cellKey);
      console.warn(`[FormulaEngine] Error evaluating ${formula} at ${cellKey}:`, err);
      return '#ERROR!';
    }
  }

  /**
   * Evaluates all formulas in the entire workbook in dependency order
   */
  public static evaluateWorkbook(workbook: WorkbookModel): WorkbookModel {
    const updated = { ...workbook, sheets: { ...workbook.sheets } };

    for (const sheetName of workbook.sheetNames) {
      const sheet = updated.sheets[sheetName];
      if (!sheet) continue;

      const updatedCells: Record<string, any> = { ...sheet.cells };

      for (const [cellAddr, cell] of Object.entries(sheet.cells)) {
        if (cell.f) {
          const calculated = this.evaluateFormula(cell.f, updated, sheetName, cellAddr);
          const formatted = formatCellValue(calculated, cell.numFmt);
          updatedCells[cellAddr] = {
            ...cell,
            calculatedValue: calculated,
            w: formatted,
            error: isError(calculated) ? String(calculated) : undefined,
          };
        } else if (cell.v !== null && cell.v !== undefined) {
          const formatted = formatCellValue(cell.v, cell.numFmt);
          updatedCells[cellAddr] = {
            ...cell,
            calculatedValue: cell.v,
            w: formatted,
          };
        }
      }

      updated.sheets[sheetName] = {
        ...sheet,
        cells: updatedCells,
      };
    }

    return updated;
  }

  private static parseAndEvaluate(expression: string, context: EvaluationContext): any {
    const tokens = tokenize(expression);
    if (tokens.length === 0) return '';
    return evaluateTokens(tokens, context);
  }
}

// --- Helpers & Evaluator internals ---

function isError(val: any): boolean {
  return typeof val === 'string' && val.startsWith('#') && val.endsWith('!');
}

function toNumber(val: any): number {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (typeof val === 'boolean') return val ? 1 : 0;
  const num = parseFloat(String(val).replace(/,/g, ''));
  return isNaN(num) ? 0 : num;
}

function toBoolean(val: any): boolean {
  if (typeof val === 'boolean') return val;
  if (typeof val === 'number') return val !== 0;
  if (typeof val === 'string') {
    const upper = val.trim().toUpperCase();
    if (upper === 'TRUE') return true;
    if (upper === 'FALSE') return false;
    return val.length > 0 && val !== '0';
  }
  return !!val;
}

function parseDateValue(val: any): Date | null {
  if (val instanceof Date) return val;
  if (typeof val === 'string' || typeof val === 'number') {
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

function flattenNumbers(args: any[]): number[] {
  const result: number[] = [];
  const walk = (item: any) => {
    if (Array.isArray(item)) {
      item.forEach(walk);
    } else if (item !== null && item !== undefined && item !== '') {
      const num = typeof item === 'number' ? item : parseFloat(String(item));
      if (!isNaN(num)) result.push(num);
    }
  };
  args.forEach(walk);
  return result;
}

function flattenAll(args: any[]): any[] {
  const result: any[] = [];
  const walk = (item: any) => {
    if (Array.isArray(item)) {
      item.forEach(walk);
    } else {
      result.push(item);
    }
  };
  args.forEach(walk);
  return result;
}

type TokenType = 'NUMBER' | 'STRING' | 'BOOLEAN' | 'OPERATOR' | 'IDENTIFIER' | 'COMMA' | 'LPAREN' | 'RPAREN' | 'RANGE';

interface Token {
  type: TokenType;
  value: string;
}

function tokenize(expr: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < expr.length) {
    const ch = expr[i];

    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    // String literal "hello"
    if (ch === '"' || ch === "'") {
      const quote = ch;
      let str = '';
      i++;
      while (i < expr.length && expr[i] !== quote) {
        if (expr[i] === '\\' && i + 1 < expr.length) {
          i++;
          str += expr[i];
        } else {
          str += expr[i];
        }
        i++;
      }
      i++; // Skip closing quote
      tokens.push({ type: 'STRING', value: str });
      continue;
    }

    // Number literal (e.g. 123, 12.34)
    if (/\d/.test(ch) || (ch === '.' && i + 1 < expr.length && /\d/.test(expr[i + 1]))) {
      let numStr = '';
      while (i < expr.length && (/[\d.]/.test(expr[i]))) {
        numStr += expr[i];
        i++;
      }
      tokens.push({ type: 'NUMBER', value: numStr });
      continue;
    }

    // Two-character operators: <=, >=, <>, !=, ==
    const twoChars = expr.substr(i, 2);
    if (['<=', '>=', '<>', '!=', '=='].includes(twoChars)) {
      tokens.push({ type: 'OPERATOR', value: twoChars });
      i += 2;
      continue;
    }

    // Single-character operators
    if (['+', '-', '*', '/', '^', '%', '&', '=', '<', '>'].includes(ch)) {
      tokens.push({ type: 'OPERATOR', value: ch });
      i++;
      continue;
    }

    if (ch === '(') {
      tokens.push({ type: 'LPAREN', value: '(' });
      i++;
      continue;
    }

    if (ch === ')') {
      tokens.push({ type: 'RPAREN', value: ')' });
      i++;
      continue;
    }

    if (ch === ',' || ch === ';') {
      tokens.push({ type: 'COMMA', value: ',' });
      i++;
      continue;
    }

    // Identifier / Cell / Range / Function / Cross-sheet reference (e.g. Sheet1!A1:B5, SUM, A1:B10, A1)
    if (/[a-zA-Z0-9_!$:.]/.test(ch)) {
      let idStr = '';
      while (i < expr.length && /[a-zA-Z0-9_!$:.]/.test(expr[i])) {
        idStr += expr[i];
        i++;
      }
      const upper = idStr.toUpperCase();
      if (upper === 'TRUE' || upper === 'FALSE') {
        tokens.push({ type: 'BOOLEAN', value: upper });
      } else if (idStr.includes(':')) {
        tokens.push({ type: 'RANGE', value: idStr });
      } else {
        tokens.push({ type: 'IDENTIFIER', value: idStr });
      }
      continue;
    }

    i++;
  }

  return tokens;
}

// Simple Pratt / Shunting-yard expression evaluator
function evaluateTokens(tokens: Token[], context: EvaluationContext): any {
  let pos = 0;

  function peek(): Token | undefined {
    return tokens[pos];
  }

  function consume(): Token {
    return tokens[pos++];
  }

  // Precedence levels
  const PRECEDENCE: Record<string, number> = {
    '=': 1, '<>': 1, '!=': 1, '<': 1, '<=': 1, '>': 1, '>=': 1,
    '&': 2,
    '+': 3, '-': 3,
    '*': 4, '/': 4, '%': 4,
    '^': 5,
  };

  function parseExpression(minPrecedence = 0): any {
    let left = parsePrimary();

    while (pos < tokens.length) {
      const tok = peek();
      if (!tok || tok.type !== 'OPERATOR') break;

      const prec = PRECEDENCE[tok.value] || 0;
      if (prec < minPrecedence) break;

      const op = consume().value;
      const right = parseExpression(prec + 1);

      left = applyBinaryOp(op, left, right);
    }

    return left;
  }

  function parsePrimary(): any {
    const tok = consume();
    if (!tok) return null;

    if (tok.type === 'NUMBER') {
      return parseFloat(tok.value);
    }

    if (tok.type === 'STRING') {
      return tok.value;
    }

    if (tok.type === 'BOOLEAN') {
      return tok.value === 'TRUE';
    }

    // Unary plus/minus
    if (tok.type === 'OPERATOR' && (tok.value === '-' || tok.value === '+')) {
      const operand = parsePrimary();
      return tok.value === '-' ? -toNumber(operand) : toNumber(operand);
    }

    if (tok.type === 'LPAREN') {
      const expr = parseExpression();
      if (peek()?.type === 'RPAREN') consume();
      return expr;
    }

    if (tok.type === 'RANGE') {
      return resolveRange(tok.value, context);
    }

    if (tok.type === 'IDENTIFIER') {
      // Check if it's a function call (next token is '(')
      if (peek()?.type === 'LPAREN') {
        consume(); // '('
        const args: any[] = [];
        if (peek()?.type !== 'RPAREN') {
          while (pos < tokens.length) {
            args.push(parseExpression());
            if (peek()?.type === 'COMMA') {
              consume();
            } else {
              break;
            }
          }
        }
        if (peek()?.type === 'RPAREN') consume();

        const fnName = tok.value.toUpperCase();
        const fn = (FormulaEngine as any).functions[fnName];
        if (fn) {
          return fn(args, context);
        }
        return '#NAME?';
      }

      // Check if it's a cell reference e.g. A1, $B$4, Sheet1!A1
      return resolveCellReference(tok.value, context);
    }

    return null;
  }

  return parseExpression();
}

function resolveCellReference(ref: string, context: EvaluationContext): any {
  let targetSheet = context.currentSheet;
  let targetCell = ref;

  if (ref.includes('!')) {
    const [sheetPart, cellPart] = ref.split('!');
    const cleanSheet = sheetPart.replace(/^['"]|['"]$/g, '');
    const foundSheet = context.workbook.sheets[cleanSheet];
    if (!foundSheet) return '#REF!';
    targetSheet = foundSheet;
    targetCell = cellPart;
  }

  const coord = addressToCoordinate(targetCell);
  if (!coord) return ref; // Not a valid coordinate, return raw string

  const cell = targetSheet.cells[targetCell.toUpperCase()];
  if (!cell) return 0; // Empty cell evaluates to 0 in numeric formulas

  if (cell.f) {
    return FormulaEngine.evaluateFormula(
      cell.f,
      context.workbook,
      targetSheet.name,
      targetCell,
      context.evaluatingStack
    );
  }

  return cell.v !== null && cell.v !== undefined ? cell.v : 0;
}

function resolveRange(rangeStr: string, context: EvaluationContext): any[][] {
  let targetSheet = context.currentSheet;
  let cleanRange = rangeStr;

  if (rangeStr.includes('!')) {
    const [sheetPart, rPart] = rangeStr.split('!');
    const cleanSheet = sheetPart.replace(/^['"]|['"]$/g, '');
    const foundSheet = context.workbook.sheets[cleanSheet];
    if (foundSheet) targetSheet = foundSheet;
    cleanRange = rPart;
  }

  const parsed = parseRangeAddress(cleanRange);
  if (!parsed) return [];

  const result: any[][] = [];
  for (let r = parsed.start.r; r <= parsed.end.r; r++) {
    const row: any[] = [];
    for (let c = parsed.start.c; c <= parsed.end.c; c++) {
      const colLetter = String.fromCharCode(65 + c);
      const addr = `${colLetter}${r + 1}`;
      const cell = targetSheet.cells[addr];
      if (!cell) {
        row.push(null);
      } else if (cell.f) {
        row.push(
          FormulaEngine.evaluateFormula(
            cell.f,
            context.workbook,
            targetSheet.name,
            addr,
            context.evaluatingStack
          )
        );
      } else {
        row.push(cell.v);
      }
    }
    result.push(row);
  }
  return result;
}

function applyBinaryOp(op: string, left: any, right: any): any {
  if (isError(left)) return left;
  if (isError(right)) return right;

  switch (op) {
    case '+':
      return toNumber(left) + toNumber(right);
    case '-':
      return toNumber(left) - toNumber(right);
    case '*':
      return toNumber(left) * toNumber(right);
    case '/': {
      const denom = toNumber(right);
      if (denom === 0) return '#DIV/0!';
      return toNumber(left) / denom;
    }
    case '%':
      return toNumber(left) % toNumber(right);
    case '^':
      return Math.pow(toNumber(left), toNumber(right));
    case '&':
      return String(left ?? '') + String(right ?? '');
    case '=':
    case '==':
      return String(left).toLowerCase() === String(right).toLowerCase();
    case '<>':
    case '!=':
      return String(left).toLowerCase() !== String(right).toLowerCase();
    case '<':
      return toNumber(left) < toNumber(right);
    case '<=':
      return toNumber(left) <= toNumber(right);
    case '>':
      return toNumber(left) > toNumber(right);
    case '>=':
      return toNumber(left) >= toNumber(right);
    default:
      return '#VALUE!';
  }
}
