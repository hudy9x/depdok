import { Mark, mergeAttributes } from '@tiptap/core';
import type { JSONContent } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    commentMark: {
      /** Apply a comment mark with the given commentId to the current selection */
      setCommentMark: (commentId: string) => ReturnType;
      /** Remove the comment mark with the given commentId */
      unsetCommentMark: (commentId: string) => ReturnType;
    };
  }
}

/**
 * CommentMark — a Tiptap inline mark that wraps commented text with a
 * `<span data-comment-id="...">` element.
 *
 * Serializes to inline HTML in both the rendered editor and in the raw
 * markdown output (via renderMarkdown), so comment anchors survive saves.
 */
export const CommentMark = Mark.create({
  name: 'commentMark',

  spanning: true,
  inclusive: false,

  addAttributes() {
    return {
      commentId: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-comment-id'),
        renderHTML: (attributes) => {
          if (!attributes.commentId) return {};
          return { 'data-comment-id': attributes.commentId };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-comment-id]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const commentId = HTMLAttributes['data-comment-id'];
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        class: 'comment-mark',
        'data-comment-id': commentId,
      }),
      0,
    ];
  },

  /**
   * Teach @tiptap/markdown how to serialize this mark.
   * The MarkdownManager derives opening/closing by calling renderMarkdown
   * with a synthetic node containing a placeholder, then splits on it.
   * We output: <span data-comment-id="ATTR">CHILDREN</span>
   */
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore — renderMarkdown is not in tiptap/core types but is read by @tiptap/markdown
  renderMarkdown(node: JSONContent, helpers: { renderChildren: () => string }) {
    const commentId = node.attrs?.commentId ?? '';
    const inner = helpers.renderChildren();
    return `<span data-comment-id="${commentId}">${inner}</span>`;
  },

  addCommands() {
    return {
      setCommentMark:
        (commentId: string) =>
        ({ commands }) => {
          return commands.setMark(this.name, { commentId });
        },
      unsetCommentMark:
        (commentId: string) =>
        ({ tr, dispatch }) => {
          const { doc } = tr;
          const markType = this.type;
          let found = false;

          doc.descendants((node, pos) => {
            if (!node.isInline) return;
            node.marks.forEach((mark) => {
              if (
                !found &&
                mark.type === markType &&
                mark.attrs.commentId === commentId
              ) {
                found = true;
                tr.removeMark(pos, pos + node.nodeSize, markType);
              }
            });
          });

          if (found && dispatch) {
            dispatch(tr);
          }
          return found;
        },
    };
  },
});
