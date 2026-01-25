import { TodoSection, TodoItem } from "../todoRenderer";
import { format, startOfDay, isSameDay as dateFnsIsSameDay, addDays } from "date-fns";

export interface DayTasks {
  date: Date;
  tasks: Array<{
    item: TodoItem;
    sectionIndex: number;
    itemIndex: number;
    sectionTitle: string;
  }>;
}

/**
 * Get array of 7 dates starting from today
 */
export function getWeekDays(): Date[] {
  const today = startOfDay(new Date());
  return Array.from({ length: 7 }, (_, i) => addDays(today, i));
}

/**
 * Format day header (e.g., "Today Mon 8 Aug", "Tomorrow Tue 9 Aug", "Wednesday 10 Aug")
 */
export function formatDayHeader(date: Date): { label: string; dateStr: string } {
  const today = startOfDay(new Date());
  const tomorrow = addDays(today, 1);

  let label: string;
  if (dateFnsIsSameDay(date, today)) {
    label = "Today";
  } else if (dateFnsIsSameDay(date, tomorrow)) {
    label = "Tomorrow";
  } else {
    label = format(date, "EEEE"); // Full day name
  }

  const dateStr = format(date, "EEE d MMM"); // e.g., "Mon 8 Aug"

  return { label, dateStr };
}

/**
 * Check if two dates are the same day
 */
export function isSameDay(date1: Date, date2: Date): boolean {
  return dateFnsIsSameDay(date1, date2);
}

/**
 * Group all tasks by their due date, defaulting tasks without dates to today
 */
export function groupTasksByDate(sections: TodoSection[]): DayTasks[] {
  const weekDays = getWeekDays();
  const today = startOfDay(new Date());

  // Initialize day tasks for each day of the week
  const dayTasksMap = new Map<string, DayTasks>();
  weekDays.forEach(day => {
    dayTasksMap.set(day.toISOString(), {
      date: day,
      tasks: []
    });
  });

  // Iterate through all sections and items
  sections.forEach((section, sectionIndex) => {
    section.items.forEach((item, itemIndex) => {
      // Determine the due date (default to today if not specified)
      let dueDate: Date;
      if (item.metadata?.due) {
        dueDate = startOfDay(new Date(item.metadata.due));
      } else {
        dueDate = today;
      }

      // Find the matching day in the week
      const matchingDay = weekDays.find(day => dateFnsIsSameDay(day, dueDate));

      // Only add if the task falls within the current week
      if (matchingDay) {
        const dayKey = matchingDay.toISOString();
        const dayTasks = dayTasksMap.get(dayKey);
        if (dayTasks) {
          dayTasks.tasks.push({
            item,
            sectionIndex,
            itemIndex,
            sectionTitle: section.title
          });
        }
      }
    });
  });

  // Convert map to array and sort by date
  return Array.from(dayTasksMap.values()).sort((a, b) =>
    a.date.getTime() - b.date.getTime()
  );
}
