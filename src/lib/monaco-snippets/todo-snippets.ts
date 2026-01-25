/**
 * Register todo snippets for .todo files
 * Provides quick insertion of todo items
 */
export function registerTodoSnippets(monaco: any, language: string) {

  console.log('🎯 Registering todo snippets...');

  monaco.languages.registerCompletionItemProvider(language, {
    triggerCharacters: ['t', 'o', 'd'],
    provideCompletionItems: (model: any, position: any) => {

      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };

      const suggestions = [
        {
          label: 'todo',
          kind: monaco.languages.CompletionItemKind.Snippet,
          documentation: 'Insert a todo item',
          insertText: '[ ] ${1:This is your todo}',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range: range,
          sortText: '0todo', // Ensure it appears first
        },
        {
          label: 'todox',
          kind: monaco.languages.CompletionItemKind.Snippet,
          documentation: 'Insert a completed todo item',
          insertText: '[x] ${1:This is your completed todo}',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range: range,
          sortText: '0todox', // Ensure it appears first
        },
      ];

      return { suggestions };
    },
  });
}
