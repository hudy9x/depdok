import { useCallback, useRef } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import {
  terminalHeightAtom,
  terminalWidthAtom,
  setTerminalHeightAtom,
  setTerminalWidthAtom,
  terminalPositionAtom,
} from '@/stores/TerminalStore';

export function useTerminalResize() {
  const panelHeight = useAtomValue(terminalHeightAtom);
  const setPanelHeight = useSetAtom(setTerminalHeightAtom);
  const panelWidth = useAtomValue(terminalWidthAtom);
  const setPanelWidth = useSetAtom(setTerminalWidthAtom);
  const terminalPosition = useAtomValue(terminalPositionAtom);

  const dragRef = useRef<{ startY: number; startH: number; startX: number; startW: number } | null>(null);

  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      dragRef.current = {
        startY: e.clientY,
        startH: panelHeight,
        startX: e.clientX,
        startW: panelWidth,
      };

      const isRight = terminalPosition === 'right';
      const maxLimit = 800;
      const minLimit = 140;

      const onMove = (ev: MouseEvent) => {
        if (!dragRef.current) return;
        if (isRight) {
          const delta = dragRef.current.startX - ev.clientX;
          const newW = Math.min(
            maxLimit,
            Math.max(minLimit, dragRef.current.startW + delta),
          );
          setPanelWidth(newW);
        } else {
          const delta = dragRef.current.startY - ev.clientY;
          const newH = Math.min(
            maxLimit,
            Math.max(minLimit, dragRef.current.startH + delta),
          );
          setPanelHeight(newH);
        }
      };

      const onUp = () => {
        dragRef.current = null;
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };

      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [panelHeight, setPanelHeight, panelWidth, setPanelWidth, terminalPosition],
  );

  return { handleDragStart };
}
