import { CellCoordinate, CellValue, RangeSelection } from './types';

/**
 * Converts 0-indexed column number to Excel column letters (0 -> "A", 25 -> "Z", 26 -> "AA", etc.)
 */
export function indexToColumn(index: number): string {
  let col = '';
  let temp = index;
  while (temp >= 0) {
    col = String.fromCharCode((temp % 26) + 65) + col;
    temp = Math.floor(temp / 26) - 1;
  }
  return col;
}

/**
 * Converts Excel column letters to 0-indexed column number ("A" -> 0, "Z" -> 25, "AA" -> 26, etc.)
 */
export function columnToIndex(columnStr: string): number {
  const upper = columnStr.toUpperCase();
  let index = 0;
  for (let i = 0; i < upper.length; i++) {
    index = index * 26 + (upper.charCodeAt(i) - 64);
  }
  return index - 1;
}

/**
 * Converts { r: 0, c: 0 } to "A1"
 */
export function coordinateToAddress(coord: CellCoordinate): string {
  return `${indexToColumn(coord.c)}${coord.r + 1}`;
}

/**
 * Converts "A1" or "$A$1" to { r: 0, c: 0 }
 */
export function addressToCoordinate(address: string): CellCoordinate | null {
  const match = address.replace(/\$/g, '').match(/^([A-Za-z]+)(\d+)$/);
  if (!match) return null;
  const colStr = match[1];
  const rowStr = match[2];
  const r = parseInt(rowStr, 10) - 1;
  const c = columnToIndex(colStr);
  if (r < 0 || c < 0 || isNaN(r) || isNaN(c)) return null;
  return { r, c };
}

/**
 * Parses range address like "A1:B5" or "A1" into RangeSelection
 */
export function parseRangeAddress(rangeStr: string): RangeSelection | null {
  const parts = rangeStr.split(':').map((p) => p.trim());
  if (parts.length === 1) {
    const coord = addressToCoordinate(parts[0]);
    if (!coord) return null;
    return { start: coord, end: coord };
  }
  if (parts.length === 2) {
    const startCoord = addressToCoordinate(parts[0]);
    const endCoord = addressToCoordinate(parts[1]);
    if (!startCoord || !endCoord) return null;
    return {
      start: {
        r: Math.min(startCoord.r, endCoord.r),
        c: Math.min(startCoord.c, endCoord.c),
      },
      end: {
        r: Math.max(startCoord.r, endCoord.r),
        c: Math.max(startCoord.c, endCoord.c),
      },
    };
  }
  return null;
}

/**
 * Normalizes RangeSelection so start is top-left and end is bottom-right
 */
export function normalizeRange(range: RangeSelection): RangeSelection {
  return {
    start: {
      r: Math.min(range.start.r, range.end.r),
      c: Math.min(range.start.c, range.end.c),
    },
    end: {
      r: Math.max(range.start.r, range.end.r),
      c: Math.max(range.start.c, range.end.c),
    },
  };
}

/**
 * Formats a RangeSelection into "A1:B5" or "A1"
 */
export function rangeToAddress(range: RangeSelection): string {
  const normalized = normalizeRange(range);
  const startAddr = coordinateToAddress(normalized.start);
  const endAddr = coordinateToAddress(normalized.end);
  if (startAddr === endAddr) return startAddr;
  return `${startAddr}:${endAddr}`;
}

/**
 * Enumerates all cell addresses within a range
 */
export function getCellAddressesInRange(range: RangeSelection): string[] {
  const normalized = normalizeRange(range);
  const addresses: string[] = [];
  for (let r = normalized.start.r; r <= normalized.end.r; r++) {
    for (let c = normalized.start.c; c <= normalized.end.c; c++) {
      addresses.push(coordinateToAddress({ r, c }));
    }
  }
  return addresses;
}

export type PresetNumberFormat =
  | 'General'
  | 'Number'
  | 'Currency'
  | 'Accounting'
  | 'Percentage'
  | 'Date'
  | 'Time'
  | 'Text';

/**
 * Formats a raw value with a given format string or preset
 */
export function formatCellValue(value: CellValue, numFmt?: string): string {
  if (value === null || value === undefined || value === '') {
    return '';
  }

  if (typeof value === 'boolean') {
    return value ? 'TRUE' : 'FALSE';
  }

  if (value instanceof Date) {
    return formatDate(value, numFmt);
  }

  if (typeof value === 'number') {
    return formatNumber(value, numFmt);
  }

  // If value is numeric string and format is specified
  if (typeof value === 'string' && numFmt && numFmt !== 'General' && numFmt !== '@') {
    const num = parseFloat(value);
    if (!isNaN(num)) {
      return formatNumber(num, numFmt);
    }
  }

  return String(value);
}

function formatNumber(num: number, fmt?: string): string {
  if (isNaN(num)) return '#VALUE!';
  if (!isFinite(num)) return '#NUM!';

  if (!fmt || fmt === 'General') {
    // Standard compact format
    if (Number.isInteger(num)) return num.toString();
    return Number(num.toFixed(8)).toString();
  }

  const upperFmt = fmt.toUpperCase();

  // Currency: "$#,##0.00" or similar
  if (upperFmt.includes('$') || upperFmt.includes('CURRENCY')) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  }

  // Percentage: "0.00%" or "0%"
  if (upperFmt.includes('%')) {
    const decimalPlaces = fmt.includes('.00') ? 2 : fmt.includes('.0') ? 1 : 0;
    return new Intl.NumberFormat('en-US', {
      style: 'percent',
      minimumFractionDigits: decimalPlaces,
      maximumFractionDigits: decimalPlaces,
    }).format(num);
  }

  // Comma formatted number: "#,##0.00" or "#,##0"
  if (fmt.includes('#,##0')) {
    const decimals = fmt.includes('.00') ? 2 : fmt.includes('.0') ? 1 : 0;
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(num);
  }

  // Fixed decimal: "0.00" or "0.0"
  if (fmt.startsWith('0.')) {
    const decimals = fmt.split('.')[1]?.length || 2;
    return num.toFixed(decimals);
  }

  if (fmt === '0' || fmt === 'Integer') {
    return Math.round(num).toString();
  }

  return num.toString();
}

function formatDate(date: Date, fmt?: string): string {
  if (isNaN(date.getTime())) return '#VALUE!';
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');

  if (fmt?.includes('YYYY/MM/DD')) return `${yyyy}/${mm}/${dd}`;
  if (fmt?.includes('MM/DD/YYYY')) return `${mm}/${dd}/${yyyy}`;
  if (fmt?.includes('DD/MM/YYYY')) return `${dd}/${mm}/${yyyy}`;
  return `${yyyy}-${mm}-${dd}`;
}
