import {
  getToday,
  getYesterday,
  getTomorrow,
  getDateForDayOfWeek,
  getDateForNextWeekDay,
  getDateForPrevWeekDay,
  DAYS,
} from './date-utils';

/**
 * Register date expansion snippets
 * Allows typing date-today, date-tomorrow, etc. and expanding to actual dates
 */
export function registerDateSnippets(monaco: any, language: string) {
  console.log('📅 Registering date snippets...');

  monaco.languages.registerCompletionItemProvider(language, {
    triggerCharacters: ['d', 'a', 't', 'e', '-'],
    provideCompletionItems: (model: any, position: any) => {
      // Get the text before cursor to find the full date- keyword
      const lineContent = model.getLineContent(position.lineNumber);
      const textBeforeCursor = lineContent.substring(0, position.column - 1);

      // Match date- followed by any word characters or hyphens
      const match = textBeforeCursor.match(/(date-[\w-]*)$/);

      let range;
      if (match) {
        // Replace the entire matched text including 'date-'
        range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: position.column - match[1].length,
          endColumn: position.column,
        };
      } else {
        // Fallback to word-based range
        const word = model.getWordUntilPosition(position);
        range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn,
        };
      }

      const suggestions = [
        // Basic date expansions
        {
          label: 'date-today',
          kind: monaco.languages.CompletionItemKind.Text,
          documentation: `Insert today's date (${getToday()})`,
          insertText: getToday(),
          range: range,
          sortText: '0date-today',
        },
        {
          label: 'date-yesterday',
          kind: monaco.languages.CompletionItemKind.Text,
          documentation: `Insert yesterday's date (${getYesterday()})`,
          insertText: getYesterday(),
          range: range,
          sortText: '0date-yesterday',
        },
        {
          label: 'date-tomorrow',
          kind: monaco.languages.CompletionItemKind.Text,
          documentation: `Insert tomorrow's date (${getTomorrow()})`,
          insertText: getTomorrow(),
          range: range,
          sortText: '0date-tomorrow',
        },

        // Current week days
        {
          label: 'date-monday',
          kind: monaco.languages.CompletionItemKind.Text,
          documentation: `Monday of current week (${getDateForDayOfWeek(DAYS.MONDAY)})`,
          insertText: getDateForDayOfWeek(DAYS.MONDAY),
          range: range,
          sortText: '1date-monday',
        },
        {
          label: 'date-tuesday',
          kind: monaco.languages.CompletionItemKind.Text,
          documentation: `Tuesday of current week (${getDateForDayOfWeek(DAYS.TUESDAY)})`,
          insertText: getDateForDayOfWeek(DAYS.TUESDAY),
          range: range,
          sortText: '1date-tuesday',
        },
        {
          label: 'date-wednesday',
          kind: monaco.languages.CompletionItemKind.Text,
          documentation: `Wednesday of current week (${getDateForDayOfWeek(DAYS.WEDNESDAY)})`,
          insertText: getDateForDayOfWeek(DAYS.WEDNESDAY),
          range: range,
          sortText: '1date-wednesday',
        },
        {
          label: 'date-thursday',
          kind: monaco.languages.CompletionItemKind.Text,
          documentation: `Thursday of current week (${getDateForDayOfWeek(DAYS.THURSDAY)})`,
          insertText: getDateForDayOfWeek(DAYS.THURSDAY),
          range: range,
          sortText: '1date-thursday',
        },
        {
          label: 'date-friday',
          kind: monaco.languages.CompletionItemKind.Text,
          documentation: `Friday of current week (${getDateForDayOfWeek(DAYS.FRIDAY)})`,
          insertText: getDateForDayOfWeek(DAYS.FRIDAY),
          range: range,
          sortText: '1date-friday',
        },
        {
          label: 'date-saturday',
          kind: monaco.languages.CompletionItemKind.Text,
          documentation: `Saturday of current week (${getDateForDayOfWeek(DAYS.SATURDAY)})`,
          insertText: getDateForDayOfWeek(DAYS.SATURDAY),
          range: range,
          sortText: '1date-saturday',
        },
        {
          label: 'date-sunday',
          kind: monaco.languages.CompletionItemKind.Text,
          documentation: `Sunday of current week (${getDateForDayOfWeek(DAYS.SUNDAY)})`,
          insertText: getDateForDayOfWeek(DAYS.SUNDAY),
          range: range,
          sortText: '1date-sunday',
        },

        // Next week days
        {
          label: 'date-next-monday',
          kind: monaco.languages.CompletionItemKind.Text,
          documentation: `Monday of next week (${getDateForNextWeekDay(DAYS.MONDAY)})`,
          insertText: getDateForNextWeekDay(DAYS.MONDAY),
          range: range,
          sortText: '2date-next-monday',
        },
        {
          label: 'date-next-tuesday',
          kind: monaco.languages.CompletionItemKind.Text,
          documentation: `Tuesday of next week (${getDateForNextWeekDay(DAYS.TUESDAY)})`,
          insertText: getDateForNextWeekDay(DAYS.TUESDAY),
          range: range,
          sortText: '2date-next-tuesday',
        },
        {
          label: 'date-next-wednesday',
          kind: monaco.languages.CompletionItemKind.Text,
          documentation: `Wednesday of next week (${getDateForNextWeekDay(DAYS.WEDNESDAY)})`,
          insertText: getDateForNextWeekDay(DAYS.WEDNESDAY),
          range: range,
          sortText: '2date-next-wednesday',
        },
        {
          label: 'date-next-thursday',
          kind: monaco.languages.CompletionItemKind.Text,
          documentation: `Thursday of next week (${getDateForNextWeekDay(DAYS.THURSDAY)})`,
          insertText: getDateForNextWeekDay(DAYS.THURSDAY),
          range: range,
          sortText: '2date-next-thursday',
        },
        {
          label: 'date-next-friday',
          kind: monaco.languages.CompletionItemKind.Text,
          documentation: `Friday of next week (${getDateForNextWeekDay(DAYS.FRIDAY)})`,
          insertText: getDateForNextWeekDay(DAYS.FRIDAY),
          range: range,
          sortText: '2date-next-friday',
        },
        {
          label: 'date-next-saturday',
          kind: monaco.languages.CompletionItemKind.Text,
          documentation: `Saturday of next week (${getDateForNextWeekDay(DAYS.SATURDAY)})`,
          insertText: getDateForNextWeekDay(DAYS.SATURDAY),
          range: range,
          sortText: '2date-next-saturday',
        },
        {
          label: 'date-next-sunday',
          kind: monaco.languages.CompletionItemKind.Text,
          documentation: `Sunday of next week (${getDateForNextWeekDay(DAYS.SUNDAY)})`,
          insertText: getDateForNextWeekDay(DAYS.SUNDAY),
          range: range,
          sortText: '2date-next-sunday',
        },

        // Previous week days
        {
          label: 'date-prev-monday',
          kind: monaco.languages.CompletionItemKind.Text,
          documentation: `Monday of previous week (${getDateForPrevWeekDay(DAYS.MONDAY)})`,
          insertText: getDateForPrevWeekDay(DAYS.MONDAY),
          range: range,
          sortText: '3date-prev-monday',
        },
        {
          label: 'date-prev-tuesday',
          kind: monaco.languages.CompletionItemKind.Text,
          documentation: `Tuesday of previous week (${getDateForPrevWeekDay(DAYS.TUESDAY)})`,
          insertText: getDateForPrevWeekDay(DAYS.TUESDAY),
          range: range,
          sortText: '3date-prev-tuesday',
        },
        {
          label: 'date-prev-wednesday',
          kind: monaco.languages.CompletionItemKind.Text,
          documentation: `Wednesday of previous week (${getDateForPrevWeekDay(DAYS.WEDNESDAY)})`,
          insertText: getDateForPrevWeekDay(DAYS.WEDNESDAY),
          range: range,
          sortText: '3date-prev-wednesday',
        },
        {
          label: 'date-prev-thursday',
          kind: monaco.languages.CompletionItemKind.Text,
          documentation: `Thursday of previous week (${getDateForPrevWeekDay(DAYS.THURSDAY)})`,
          insertText: getDateForPrevWeekDay(DAYS.THURSDAY),
          range: range,
          sortText: '3date-prev-thursday',
        },
        {
          label: 'date-prev-friday',
          kind: monaco.languages.CompletionItemKind.Text,
          documentation: `Friday of previous week (${getDateForPrevWeekDay(DAYS.FRIDAY)})`,
          insertText: getDateForPrevWeekDay(DAYS.FRIDAY),
          range: range,
          sortText: '3date-prev-friday',
        },
        {
          label: 'date-prev-saturday',
          kind: monaco.languages.CompletionItemKind.Text,
          documentation: `Saturday of previous week (${getDateForPrevWeekDay(DAYS.SATURDAY)})`,
          insertText: getDateForPrevWeekDay(DAYS.SATURDAY),
          range: range,
          sortText: '3date-prev-saturday',
        },
        {
          label: 'date-prev-sunday',
          kind: monaco.languages.CompletionItemKind.Text,
          documentation: `Sunday of previous week (${getDateForPrevWeekDay(DAYS.SUNDAY)})`,
          insertText: getDateForPrevWeekDay(DAYS.SUNDAY),
          range: range,
          sortText: '3date-prev-sunday',
        },
      ];

      return { suggestions };
    },
  });
}
