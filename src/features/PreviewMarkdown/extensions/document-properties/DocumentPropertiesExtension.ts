import { Node } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { DocumentPropertiesNodeView } from "./DocumentPropertiesNodeView";

export interface DocumentPropertiesOptions {
  HTMLAttributes: Record<string, any>;
}

export const DocumentPropertiesExtension = Node.create<DocumentPropertiesOptions>({
  name: "documentProperties",
  group: "block",
  atom: true,
  selectable: false,
  draggable: false,

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      metadata: {
        default: {},
        parseHTML: (element) => {
          try {
            const attr = element.getAttribute("data-metadata") || "";
            const decoded = attr.includes("%") ? decodeURIComponent(attr) : attr;
            return JSON.parse(decoded || "{}");
          } catch {
            return {};
          }
        },
        renderHTML: (attributes) => ({
          "data-metadata": encodeURIComponent(JSON.stringify(attributes.metadata || {})),
        }),
      },
      raw: {
        default: "",
        parseHTML: (element) => {
          try {
            const attr = element.getAttribute("data-raw") || "";
            return attr.includes("%") ? decodeURIComponent(attr) : attr;
          } catch {
            return element.getAttribute("data-raw") || "";
          }
        },
        renderHTML: (attributes) => ({
          "data-raw": encodeURIComponent(attributes.raw || ""),
        }),
      },
      filePath: {
        default: "",
        parseHTML: (element) => {
          try {
            const attr = element.getAttribute("data-file-path") || "";
            return attr.includes("%") ? decodeURIComponent(attr) : attr;
          } catch {
            return element.getAttribute("data-file-path") || "";
          }
        },
        renderHTML: (attributes) => ({
          "data-file-path": encodeURIComponent(attributes.filePath || ""),
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="document-properties"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", { "data-type": "document-properties", ...HTMLAttributes }];
  },

  // Leave markdown output empty so that the frontmatter serializer cleanly prepends the raw YAML block
  renderMarkdown() {
    return "";
  },

  addNodeView() {
    return ReactNodeViewRenderer(DocumentPropertiesNodeView);
  },
});
