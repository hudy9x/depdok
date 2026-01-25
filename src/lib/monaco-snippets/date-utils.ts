/**
 * Date utility functions for date expansion snippets
 */

/**
 * Format date to YYYY-MM-DD
 */
export function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get today's date
 */
export function getToday(): string {
  return formatDate(new Date());
}

/**
 * Get yesterday's date
 */
export function getYesterday(): string {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return formatDate(date);
}

/**
 * Get tomorrow's date
 */
export function getTomorrow(): string {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return formatDate(date);
}

/**
 * Get date for a specific day of the current week (Monday-based week)
 * @param dayOfWeek 1 = Monday, 2 = Tuesday, ..., 7 = Sunday
 */
export function getDateForDayOfWeek(dayOfWeek: number): string {
  const today = new Date();
  const currentDay = today.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday

  // Convert to Monday-based week (1 = Monday, 7 = Sunday)
  const currentDayMonBased = currentDay === 0 ? 7 : currentDay;

  // Calculate difference
  const diff = dayOfWeek - currentDayMonBased;

  const targetDate = new Date(today);
  targetDate.setDate(today.getDate() + diff);
  return formatDate(targetDate);
}

/**
 * Get date for a specific day of next week (Monday-based week)
 * @param dayOfWeek 1 = Monday, 2 = Tuesday, ..., 7 = Sunday
 */
export function getDateForNextWeekDay(dayOfWeek: number): string {
  const today = new Date();
  const currentDay = today.getDay();

  // Convert to Monday-based week
  const currentDayMonBased = currentDay === 0 ? 7 : currentDay;

  // Calculate difference to next week
  const diff = dayOfWeek - currentDayMonBased + 7;

  const targetDate = new Date(today);
  targetDate.setDate(today.getDate() + diff);
  return formatDate(targetDate);
}

/**
 * Get date for a specific day of previous week (Monday-based week)
 * @param dayOfWeek 1 = Monday, 2 = Tuesday, ..., 7 = Sunday
 */
export function getDateForPrevWeekDay(dayOfWeek: number): string {
  const today = new Date();
  const currentDay = today.getDay();

  // Convert to Monday-based week
  const currentDayMonBased = currentDay === 0 ? 7 : currentDay;

  // Calculate difference to previous week
  const diff = dayOfWeek - currentDayMonBased - 7;

  const targetDate = new Date(today);
  targetDate.setDate(today.getDate() + diff);
  return formatDate(targetDate);
}

// Day of week constants (Monday-based)
export const DAYS = {
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6,
  SUNDAY: 7,
};
