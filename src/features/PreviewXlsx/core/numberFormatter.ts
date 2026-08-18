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
  | 'DateTime'
  | 'Time'
  | 'Text';

/**
 * Checks if a format string represents a date or time format.
 */
export function isDateOrTimeFormat(fmt?: string): boolean {
  if (!fmt || fmt === 'General' || fmt === '@' || fmt.startsWith('$') || fmt.includes('%') || fmt.includes('#,##0')) {
    return false;
  }
  const upper = fmt.toUpperCase();
  if (upper === 'DATE' || upper === 'DATETIME' || upper === 'TIME') return true;
  return (
    upper.includes('YYYY') ||
    upper.includes('YY') ||
    upper.includes('DD') ||
    upper.includes('HH') ||
    upper.includes('SS') ||
    upper.includes('AM/PM') ||
    upper.includes('MM/DD') ||
    upper.includes('DD/MM') ||
    upper.includes('YYYY-MM') ||
    upper.includes('YYYY/MM') ||
    (upper.includes('M/') && upper.includes('/Y')) ||
    (upper.includes('D/') && upper.includes('/Y'))
  );
}

/**
 * Checks if a format string includes a time component.
 */
export function hasTimeFormat(fmt?: string): boolean {
  if (!fmt) return false;
  const upper = fmt.toUpperCase();
  return (
    upper === 'DATETIME' ||
    upper === 'TIME' ||
    upper.includes('HH') ||
    upper.includes('SS') ||
    upper.includes('AM/PM') ||
    upper.includes(':MM')
  );
}

/**
 * Parses a cell value into a JavaScript Date object if possible.
 */
export function parseDateValue(value: CellValue): Date | null {
  if (!value) return null;
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === 'number') {
    // Excel date serial number handling (days since Dec 30, 1899)
    if (value > 0 && value < 2958465) {
      const utcDays = Math.floor(value - 25569);
      const utcValue = utcDays * 86400;
      const dateInfo = new Date(utcValue * 1000);
      const fractionalDay = value - Math.floor(value) + 0.0000001;
      let totalSeconds = Math.floor(86400 * fractionalDay);
      const seconds = totalSeconds % 60;
      totalSeconds = Math.floor(totalSeconds / 60);
      const minutes = totalSeconds % 60;
      const hours = Math.floor(totalSeconds / 60);
      return new Date(
        dateInfo.getUTCFullYear(),
        dateInfo.getUTCMonth(),
        dateInfo.getUTCDate(),
        hours,
        minutes,
        seconds
      );
    }
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;

    // Handle "YYYY-MM-DD HH:mm:ss" or "YYYY-MM-DD HH:mm"
    const isoLikeMatch = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/);
    if (isoLikeMatch) {
      const y = parseInt(isoLikeMatch[1], 10);
      const m = parseInt(isoLikeMatch[2], 10) - 1;
      const d = parseInt(isoLikeMatch[3], 10);
      const hh = isoLikeMatch[4] ? parseInt(isoLikeMatch[4], 10) : 0;
      const mm = isoLikeMatch[5] ? parseInt(isoLikeMatch[5], 10) : 0;
      const ss = isoLikeMatch[6] ? parseInt(isoLikeMatch[6], 10) : 0;
      const date = new Date(y, m, d, hh, mm, ss);
      if (!isNaN(date.getTime())) return date;
    }

    // Handle "MM/DD/YYYY" or "DD/MM/YYYY"
    const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/);
    if (slashMatch) {
      const p1 = parseInt(slashMatch[1], 10);
      const p2 = parseInt(slashMatch[2], 10);
      const y = parseInt(slashMatch[3], 10);
      const hh = slashMatch[4] ? parseInt(slashMatch[4], 10) : 0;
      const mm = slashMatch[5] ? parseInt(slashMatch[5], 10) : 0;
      const ss = slashMatch[6] ? parseInt(slashMatch[6], 10) : 0;
      // If p1 > 12, assume DD/MM/YYYY, else MM/DD/YYYY
      const m = p1 > 12 ? p2 - 1 : p1 - 1;
      const d = p1 > 12 ? p1 : p2;
      const date = new Date(y, m, d, hh, mm, ss);
      if (!isNaN(date.getTime())) return date;
    }

    // Fallback standard Date.parse
    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) return parsed;
  }

  return null;
}

/**
 * Formats a Date object according to a format string.
 */
export function formatDateToPattern(date: Date, fmt?: string): string {
  if (isNaN(date.getTime())) return '#VALUE!';
  const yyyy = String(date.getFullYear());
  const yy = yyyy.slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');

  if (!fmt || fmt === 'Date' || fmt === 'YYYY-MM-DD') {
    return `${yyyy}-${mm}-${dd}`;
  }

  const upper = fmt.toUpperCase();

  if (upper === 'DATETIME' || upper.includes('YYYY-MM-DD HH:MM:SS') || upper.includes('YYYY-MM-DD HH:MM:SS')) {
    return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
  }
  if (upper.includes('YYYY-MM-DD HH:MM')) {
    return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
  }
  if (upper.includes('YYYY/MM/DD HH:MM:SS')) {
    return `${yyyy}/${mm}/${dd} ${hh}:${min}:${ss}`;
  }
  if (upper.includes('YYYY/MM/DD HH:MM')) {
    return `${yyyy}/${mm}/${dd} ${hh}:${min}`;
  }
  if (upper.includes('YYYY/MM/DD')) return `${yyyy}/${mm}/${dd}`;
  if (upper.includes('MM/DD/YYYY HH:MM:SS')) return `${mm}/${dd}/${yyyy} ${hh}:${min}:${ss}`;
  if (upper.includes('MM/DD/YYYY')) return `${mm}/${dd}/${yyyy}`;
  if (upper.includes('DD/MM/YYYY HH:MM:SS')) return `${dd}/${mm}/${yyyy} ${hh}:${min}:${ss}`;
  if (upper.includes('DD/MM/YYYY')) return `${dd}/${mm}/${yyyy}`;
  if (upper.includes('HH:MM:SS') || upper === 'TIME') return `${hh}:${min}:${ss}`;
  if (upper.includes('YYYY') && upper.includes('MM') && upper.includes('DD')) {
    return `${yyyy}-${mm}-${dd}`;
  }
  if (upper.includes('YY') && upper.includes('MM') && upper.includes('DD')) {
    return `${yy}-${mm}-${dd}`;
  }

  return `${yyyy}-${mm}-${dd}`;
}

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

  // If format is date/time or value is Date
  if (value instanceof Date || (numFmt && isDateOrTimeFormat(numFmt))) {
    const parsedDate = value instanceof Date ? value : parseDateValue(value);
    if (parsedDate) {
      return formatDateToPattern(parsedDate, numFmt);
    }
  }

  if (typeof value === 'number') {
    return formatNumber(value, numFmt);
  }

  // If value is numeric string and format is specified
  if (typeof value === 'string' && numFmt && numFmt !== 'General' && numFmt !== '@') {
    const num = parseFloat(value);
    if (!isNaN(num) && !isDateOrTimeFormat(numFmt)) {
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

export function formatDate(date: Date, fmt?: string): string {
  return formatDateToPattern(date, fmt);
}
