/**
 * Monaco Editor Animation Utilities
 * Provides sequential fade-in animations for programmatic content updates
 */

interface AnimateContentUpdateOptions {
  editor: any;
  monaco: any;
  newContent: string;
  chunkSize?: number;
  interval?: number;
}

/**
 * Animates content update with sequential word-by-word fade-in effect
 * 
 * @param options - Configuration for the animation
 * @returns Promise that resolves when content is set (animation continues in background)
 */
export async function animateContentUpdate({
  editor,
  monaco,
  newContent,
  chunkSize = 5,
  interval = 30,
}: AnimateContentUpdateOptions): Promise<void> {
  // 1. Set content instantly
  const fullRange = editor.getModel()?.getFullModelRange();
  if (!fullRange) return;

  editor.executeEdits("animated-update", [{
    range: fullRange,
    text: newContent,
    forceMoveMarkers: true
  }]);

  // 2. Parse the document into word-based ranges
  const model = editor.getModel();
  const words: any[] = [];

  if (model) {
    const lineCount = model.getLineCount();
    for (let i = 1; i <= lineCount; i++) {
      const lineContent = model.getLineContent(i);
      const lineWords = lineContent.split(/(\s+)/); // Keep whitespace
      let currentColumn = 1;

      lineWords.forEach((word: string) => {
        if (word.trim().length > 0) {
          words.push(new monaco.Range(i, currentColumn, i, currentColumn + word.length));
        }
        currentColumn += word.length;
      });
    }
  }

  // 3. Apply "hidden" state to all words initially
  const wordDecorations = editor.deltaDecorations([], words.map((range: any) => ({
    range: range,
    options: { inlineClassName: 'monaco-hidden-text', stickiness: 1 }
  })));

  // 4. Trigger the reveal in chunks
  const allFadeInIds: string[] = [];

  for (let i = 0; i < words.length; i += chunkSize) {
    await new Promise(resolve => setTimeout(resolve, interval));

    const chunkIndices = Array.from({ length: Math.min(chunkSize, words.length - i) }, (_, k) => i + k);
    const chunkOldIds = chunkIndices.map(idx => wordDecorations[idx]);

    const chunkNewDecorations = chunkIndices.map(idx => ({
      range: words[idx],
      options: { inlineClassName: 'monaco-fade-in-text', stickiness: 1 }
    }));

    // Atomically replace hidden decorations with fade-in decorations
    const newIds = editor.deltaDecorations(chunkOldIds, chunkNewDecorations);
    allFadeInIds.push(...newIds);
  }

  // Note: We don't clean up the fade-in decorations because:
  // 1. The CSS animation uses 'forwards', so text stays at opacity: 1
  // 2. Removing decorations causes a brief flash/blink
  // 3. The decorations are harmless once animation completes
}
