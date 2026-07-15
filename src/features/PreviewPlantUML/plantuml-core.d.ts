declare module '@plantuml/core/viz-global.js';
declare module '@plantuml/core' {
  export function render(
    lines: string[],
    elementId: string,
    options?: { dark?: boolean }
  ): void;

  export function renderToString(
    lines: string[],
    onSuccess: (svg: string) => void,
    onError: (err: string) => void,
    options?: { dark?: boolean }
  ): void;
}
