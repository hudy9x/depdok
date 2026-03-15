import { formatBlockAtLine } from "./format-formatter";

/**
 * Register Cmd+Shift+F / Ctrl+Shift+F for .format files.
 * Formats only the block where the cursor currently sits.
 */
export function registerFormatBlockAction(
  editor: any,
  monaco: any,
  onFormat: (formattedContent: string) => void
) {
  editor.addAction({
    id: "format-block",
    label: "Format Block (Cmd+Shift+F)",
    keybindings: [
      monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyF,
    ],
    run: (ed: any) => {
      const currentContent: string = ed.getValue();
      const cursorLine: number = ed.getPosition()?.lineNumber ?? 1;

      const result = formatBlockAtLine(currentContent, cursorLine);
      if (result === null) return; // cursor not inside a block

      const position = ed.getPosition();
      ed.setValue(result);
      onFormat(result);

      // Restore cursor position
      if (position) {
        ed.setPosition(position);
      }
    },
  });
}
