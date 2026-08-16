import { Extension } from '@tiptap/core';
import Suggestion, { SuggestionOptions, SuggestionProps } from '@tiptap/suggestion';
import { ReactRenderer } from '@tiptap/react';
import { computePosition, offset, flip, shift, autoUpdate } from '@floating-ui/dom';
import { SlashCommandList, SlashCommandListRef } from './SlashCommandList';
import { getSlashCommandItems, SlashCommandItem } from './slashCommandItems';

export interface SlashCommandOptions {
  suggestion: Omit<SuggestionOptions<SlashCommandItem>, 'editor'>;
}

export const SlashCommandExtension = Extension.create<SlashCommandOptions>({
  name: 'slashCommand',

  addOptions() {
    return {
      suggestion: {
        char: '/',
        allow: ({ state, range }) => {
          const $from = state.doc.resolve(range.from);
          const type = $from.parent.type.name;
          if (type === 'codeBlock') {
            return false;
          }
          // Only trigger at start of line or after whitespace
          const isStartOfLine = $from.parentOffset <= 1;
          if (isStartOfLine) return true;
          const textBefore = $from.parent.textBetween(0, $from.parentOffset - 1);
          return textBefore.endsWith(' ') || textBefore.endsWith('\n');
        },
        command: ({ editor, range, props }) => {
          props.command({ editor, range });
        },
        items: ({ query }) => {
          return getSlashCommandItems(query);
        },
        render: () => {
          let component: ReactRenderer<SlashCommandListRef> | null = null;
          let popup: HTMLDivElement | null = null;
          let cleanupAutoUpdate: (() => void) | null = null;
          let currentProps: SuggestionProps<SlashCommandItem> | null = null;

          const updatePosition = () => {
            const rect = currentProps?.clientRect?.();
            if (!rect || !popup) return;

            const virtualElement = {
              getBoundingClientRect: () => rect,
            };

            computePosition(virtualElement, popup, {
              placement: 'bottom-start',
              middleware: [
                offset(6),
                flip({ fallbackPlacements: ['top-start', 'bottom-end', 'top-end'] }),
                shift({ padding: 8 }),
              ],
            }).then(({ x, y }) => {
              if (popup) {
                Object.assign(popup.style, {
                  left: `${x}px`,
                  top: `${y}px`,
                  visibility: 'visible',
                  opacity: '1',
                });
              }
            });
          };

          return {
            onStart: (props) => {
              currentProps = props;
              component = new ReactRenderer(SlashCommandList, {
                props,
                editor: props.editor,
              });

              if (!props.clientRect) {
                return;
              }

              popup = document.createElement('div');
              popup.className = 'slash-command-popup-container';
              popup.style.position = 'fixed';
              popup.style.zIndex = '9999';
              popup.style.pointerEvents = 'auto';
              popup.style.visibility = 'hidden';
              popup.style.opacity = '0';
              popup.style.transition = 'opacity 60ms ease-out';
              popup.appendChild(component.element);
              document.body.appendChild(popup);

              cleanupAutoUpdate = autoUpdate(
                { getBoundingClientRect: () => currentProps?.clientRect?.() || new DOMRect() },
                popup,
                updatePosition
              );
              updatePosition();
            },

            onUpdate: (props) => {
              currentProps = props;
              component?.updateProps(props);
              updatePosition();
            },

            onKeyDown: (props) => {
              if (props.event.key === 'Escape') {
                popup?.remove();
                return true;
              }
              return component?.ref?.onKeyDown(props) ?? false;
            },

            onExit: () => {
              cleanupAutoUpdate?.();
              popup?.remove();
              component?.destroy();
              popup = null;
              component = null;
              currentProps = null;
            },
          };
        },
      },
    };
  },

  addKeyboardShortcuts() {
    return {
      'Mod-/': () => {
        return this.editor.commands.insertContent('/');
      },
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ];
  },
});
