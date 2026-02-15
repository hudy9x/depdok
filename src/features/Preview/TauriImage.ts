import Image from '@tiptap/extension-image';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { TauriImageNodeView } from './TauriImageNodeView';

/**
 * Custom Image extension for Tauri that handles local file paths
 * and resolves relative paths based on the markdown file location
 */
export const createTauriImage = (markdownFilePath: string | null) => {
  return Image.extend({
    addOptions() {
      return {
        ...this.parent?.(),
        markdownFilePath,
        inline: false,
        allowBase64: false,
        HTMLAttributes: {},
        resize: false,
      };
    },

    addAttributes() {
      return {
        ...this.parent?.(),
        src: {
          default: null,
          parseHTML: element => element.getAttribute('src'),
          renderHTML: attributes => {
            // Keep this for copy/paste HTML behavior, 
            // but the NodeView handles the actual editor rendering.
            return {
              src: attributes.src
            };
          }
        }
      };
    },

    addNodeView() {
      return ReactNodeViewRenderer(TauriImageNodeView);
    },
  });
};
