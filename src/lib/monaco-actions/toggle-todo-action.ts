/**
 * Register toggle todo checkbox action
 * Adds Cmd+Shift+X keyboard shortcut to toggle [ ] <-> [x]
 */
export function registerToggleTodoAction(editor: any, monaco: any) {
  editor.addAction({
    id: 'toggle-todo',
    label: 'Toggle Todo Checkbox',
    keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyX],
    run: (ed: any) => {
      const position = ed.getPosition();
      if (!position) return;

      const lineNumber = position.lineNumber;
      const lineContent = ed.getModel().getLineContent(lineNumber);

      // Regex patterns to match todo checkboxes
      const uncheckedPattern = /\[\s*\]/;
      const checkedPattern = /\[[xX]\]/;

      let newLineContent: string;

      if (uncheckedPattern.test(lineContent)) {
        // Toggle [ ] to [x]
        newLineContent = lineContent.replace(uncheckedPattern, '[x]');
      } else if (checkedPattern.test(lineContent)) {
        // Toggle [x] or [X] to [ ]
        newLineContent = lineContent.replace(checkedPattern, '[ ]');
      } else {
        // No checkbox found, do nothing
        return;
      }

      // Replace the line content
      const range = {
        startLineNumber: lineNumber,
        startColumn: 1,
        endLineNumber: lineNumber,
        endColumn: ed.getModel().getLineMaxColumn(lineNumber),
      };

      ed.executeEdits('toggle-todo', [
        {
          range: range,
          text: newLineContent,
        },
      ]);

      // Restore cursor position
      ed.setPosition(position);
    },
  });
}
