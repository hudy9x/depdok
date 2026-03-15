import type { FormatBlockType } from "@/lib/format-parser";

interface BlockButton {
  type: FormatBlockType;
  label: string;
  color: string;
}

const BLOCK_BUTTONS: BlockButton[] = [
  { type: "json", label: "JSON", color: "#f59e0b" },
  { type: "xml", label: "XML", color: "#3b82f6" },
  { type: "html", label: "HTML", color: "#f97316" },
  { type: "yaml", label: "YAML", color: "#a855f7" },
];

const BLOCK_TEMPLATES: Record<FormatBlockType, string> = {
  json: "~~~json\n\n~~~",
  xml: "~~~xml\n\n~~~",
  html: "~~~html\n\n~~~",
  yaml: "~~~yaml\n\n~~~",
  text: "",
};

/**
 * Register a Monaco content widget that appears above the caret
 * whenever the user is on a blank line in a .format file.
 * Clicking a button inserts the corresponding block template.
 *
 * Returns a cleanup function that removes the widget.
 */
export function registerFormatLinePopover(editor: any, monaco: any): () => void {
  // Build the DOM node for the widget
  // Monaco controls the outer container's display — we must NOT style it.
  // All visual styling goes on an inner element Monaco can't touch.
  const container = document.createElement("div");

  const row = document.createElement("div");
  row.style.cssText = `
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 4px;
    background: var(--popover, #1e1e2e);
    border: 1px solid var(--border, #313244);
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.25);
    pointer-events: all;
    z-index: 9999;
    opacity: 0;
    transform: translateY(4px);
    transition: opacity 0.12s ease, transform 0.12s ease;
  `;
  container.appendChild(row);

  BLOCK_BUTTONS.forEach(({ type, label, color }) => {
    const btn = document.createElement("button");
    btn.title = `Insert ${label} block`;
    btn.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 3px 6px;
      border: 1px solid ${color}55;
      border-radius: 4px;
      background: ${color}1a;
      color: ${color};
      font-size: 10px;
      font-family: monospace;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.1s;
      flex-shrink: 0;
    `;
    btn.textContent = label; btn.addEventListener("mouseenter", () => {
      btn.style.background = `${color}30`;
    });
    btn.addEventListener("mouseleave", () => {
      btn.style.background = `${color}1a`;
    });
    btn.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();

      const position = editor.getPosition();
      if (!position) return;

      const template = BLOCK_TEMPLATES[type];
      // Insert template at current line, then position cursor on the empty middle line
      editor.executeEdits("format-popover", [
        {
          range: new monaco.Range(
            position.lineNumber,
            1,
            position.lineNumber,
            editor.getModel()?.getLineLength(position.lineNumber) + 1 || 1
          ),
          text: template,
          forceMoveMarkers: true,
        },
      ]);

      // Move cursor to the blank line inside the block (line + 1)
      const innerLine = position.lineNumber + 1;
      editor.setPosition({ lineNumber: innerLine, column: 1 });
      editor.focus();
    });
    row.appendChild(btn);
  });

  // Content widget definition
  let isVisible = false;

  const widget = {
    getId: () => "format.line.popover",
    getDomNode: () => container,
    getPosition: () => {
      const pos = editor.getPosition();
      if (!pos) return null;
      return {
        position: { lineNumber: pos.lineNumber, column: 1 },
        preference: [
          (monaco.editor.ContentWidgetPositionPreference || {}).ABOVE ?? 0,
        ],
      };
    },
  };

  editor.addContentWidget(widget);

  const show = () => {
    if (!isVisible) {
      isVisible = true;
      row.style.opacity = "1";
      row.style.transform = "translateY(-10px)";
    }
    editor.layoutContentWidget(widget);
  };

  const hide = () => {
    if (isVisible) {
      isVisible = false;
      row.style.opacity = "0";
      row.style.transform = "translateY(4px)";
    }
  };

  const onCursorChange = () => {
    const pos = editor.getPosition();
    const model = editor.getModel();
    if (!pos || !model) { hide(); return; }

    const lineContent = model.getLineContent(pos.lineNumber);
    if (lineContent.trim() === "") {
      show();
    } else {
      hide();
    }
  };

  const disposable = editor.onDidChangeCursorPosition(onCursorChange);

  return () => {
    disposable.dispose();
    editor.removeContentWidget(widget);
  };
}
