import { format as formatDate, formatISO } from "date-fns";

export interface GetCurrentDatetimeArgs {
  /**
   * Optional date-fns format token string (e.g. "yyyyMMdd-HHmm", "yyyy-MM-dd", "HH:mm:ss").
   * Defaults to "yyyy-MM-dd HH:mm:ss".
   */
  format?: string;
}

export interface GetCurrentDatetimeResult {
  iso: string;
  formatted: string;
  compactTimestamp: string;
  date: string;
  time: string;
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  dayOfWeek: string;
  timezone: string;
  unixTimestamp: number;
}

export function getCurrentDatetimeTool(args?: GetCurrentDatetimeArgs): GetCurrentDatetimeResult {
  const now = new Date();
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const customFormat = args?.format;

  let formatted = "";
  if (customFormat) {
    try {
      formatted = formatDate(now, customFormat);
    } catch {
      formatted = formatDate(now, "yyyy-MM-dd HH:mm:ss");
    }
  } else {
    formatted = formatDate(now, "yyyy-MM-dd HH:mm:ss");
  }

  return {
    iso: formatISO(now),
    formatted,
    compactTimestamp: formatDate(now, "yyyyMMdd-HHmm"),
    date: formatDate(now, "yyyy-MM-dd"),
    time: formatDate(now, "HH:mm:ss"),
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate(),
    hour: now.getHours(),
    minute: now.getMinutes(),
    second: now.getSeconds(),
    dayOfWeek: formatDate(now, "EEEE"),
    timezone,
    unixTimestamp: Math.floor(now.getTime() / 1000),
  };
}
