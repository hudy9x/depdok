/**
 * Register duplicate line action
 * Adds Cmd+D keyboard shortcut to duplicate current line or selection
 */
export function registerDuplicateLineAction(editor: any, monaco: any) {
  editor.addAction({
    id: 'duplicate-line',
    label: 'Duplicate Line',
    keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyD],
    run: (ed: any) => {
      const selection = ed.getSelection();
      if (!selection) return;

      const model = ed.getModel();

      // Check if there's a selection
      if (selection.isEmpty()) {
        // No selection - duplicate the current line
        const lineNumber = selection.startLineNumber;
        const lineContent = model.getLineContent(lineNumber);
        const lineEndColumn = model.getLineMaxColumn(lineNumber);

        ed.executeEdits('duplicate-line', [
          {
            range: {
              startLineNumber: lineNumber,
              startColumn: lineEndColumn,
              endLineNumber: lineNumber,
              endColumn: lineEndColumn,
            },
            text: '\n' + lineContent,
          },
        ]);

        // Move cursor to the duplicated line
        ed.setPosition({
          lineNumber: lineNumber + 1,
          column: selection.startColumn,
        });
      } else {
        // Has selection - duplicate the selected text
        const selectedText = model.getValueInRange(selection);

        ed.executeEdits('duplicate-selection', [
          {
            range: {
              startLineNumber: selection.endLineNumber,
              startColumn: selection.endColumn,
              endLineNumber: selection.endLineNumber,
              endColumn: selection.endColumn,
            },
            text: '\n' + selectedText,
          },
        ]);

        // Move cursor to the end of duplicated content
        const lines = selectedText.split('\n');
        const newLineNumber = selection.endLineNumber + lines.length;
        ed.setPosition({
          lineNumber: newLineNumber,
          column: lines[lines.length - 1].length + 1,
        });
      }
    },
  });
}
