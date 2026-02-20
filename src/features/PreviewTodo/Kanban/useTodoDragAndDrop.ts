import { useState, useCallback } from "react";
import { DragEndEvent, DragOverEvent, DragStartEvent } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { LiveSection, LiveItem, buildLiveSections } from "./dndTypes";
import { TodoSection } from "../todoRenderer";

interface UseTodoDragAndDropProps {
  sortedSections: TodoSection[];
  documentSections: TodoSection[];
  handleSetSectionsOrder: (sections: TodoSection[]) => void;
  handleMoveItem: (origDocSi: number, origItemIdx: number, finalDocSi: number, finalIi: number) => void;
}

export function useTodoDragAndDrop({
  sortedSections,
  documentSections,
  handleSetSectionsOrder,
  handleMoveItem
}: UseTodoDragAndDropProps) {
  const [liveSections, setLiveSections] = useState<LiveSection[] | null>(null);
  const [activeBoardId, setActiveBoardId] = useState<string | null>(null);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const id = String(event.active.id);
    const live = buildLiveSections(sortedSections, documentSections);
    setLiveSections(live);

    if (live.some((s) => s._id === id)) {
      setActiveBoardId(id);
    } else {
      setActiveItemId(id);
    }
  }, [sortedSections, documentSections]);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event;
    if (!over || !liveSections) return;

    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId === overId) return;

    // Board reorder
    if (activeBoardId) {
      const ai = liveSections.findIndex((s) => s._id === activeId);

      // If overId is a board, use it directly
      let oi = liveSections.findIndex((s) => s._id === overId);

      // If overId is NOT a board, check if it's an item inside a board
      if (oi === -1) {
        oi = liveSections.findIndex((s) => s.items.some((i) => i._id === overId));
      }

      if (ai === -1 || oi === -1 || ai === oi) return;
      setLiveSections(arrayMove(liveSections, ai, oi));
      return;
    }

    // Item move
    if (activeItemId) {
      // Find source
      let srcSi = -1, srcIi = -1;
      for (let si = 0; si < liveSections.length; si++) {
        const ii = liveSections[si].items.findIndex((it) => it._id === activeId);
        if (ii !== -1) { srcSi = si; srcIi = ii; break; }
      }
      if (srcSi === -1) return;

      // Find target
      let tgtSi = -1, tgtIi = -1;
      const overBoardIdx = liveSections.findIndex((s) => s._id === overId);
      if (overBoardIdx !== -1) {
        tgtSi = overBoardIdx;
        tgtIi = liveSections[overBoardIdx].items.length;
      } else {
        for (let si = 0; si < liveSections.length; si++) {
          const ii = liveSections[si].items.findIndex((it) => it._id === overId);
          if (ii !== -1) { tgtSi = si; tgtIi = ii; break; }
        }
      }
      if (tgtSi === -1) return;
      if (srcSi === tgtSi && srcIi === tgtIi) return;

      const next = liveSections.map((s) => ({ ...s, items: [...s.items] }));
      const [moved] = next[srcSi].items.splice(srcIi, 1);

      // Adjust index when moving down within same section
      if (tgtSi === srcSi && tgtIi > srcIi) tgtIi--;

      next[tgtSi].items.splice(Math.min(tgtIi, next[tgtSi].items.length), 0, moved);
      setLiveSections(next);
    }
  }, [activeBoardId, activeItemId, liveSections]);

  const reset = useCallback(() => {
    setActiveBoardId(null);
    setActiveItemId(null);
    setLiveSections(null);
  }, []);

  const handleDragEnd = useCallback((_event: DragEndEvent) => {
    if (!liveSections) { reset(); return; }

    if (activeBoardId) {
      // Reconstruct the full ordered list of sections
      const newOrderedSections = liveSections.map(ls => documentSections[ls._docIdx]);
      handleSetSectionsOrder(newOrderedSections);
    }

    if (activeItemId) {
      // Find where the active item ended up
      let finalSi = -1, finalIi = -1;
      for (let si = 0; si < liveSections.length; si++) {
        const ii = liveSections[si].items.findIndex(it => it._id === activeItemId);
        if (ii !== -1) { finalSi = si; finalIi = ii; break; }
      }
      if (finalSi !== -1) {
        const liveItem = liveSections[finalSi].items[finalIi];
        const origSortedSectionIdx = liveItem._origSectionIdx;
        const origItemIdx = liveItem._origItemIdx;
        const finalSortedSectionIdx = liveSections[finalSi]._origIdx;

        // Map sortedSections indices → document.sections indices
        const origDocSi = documentSections.indexOf(sortedSections[origSortedSectionIdx]);
        const finalDocSi = documentSections.indexOf(sortedSections[finalSortedSectionIdx]);

        if (origDocSi !== -1 && finalDocSi !== -1) {
          handleMoveItem(origDocSi, origItemIdx, finalDocSi, finalIi);
        }
      }
    }

    reset();
  }, [activeBoardId, activeItemId, liveSections, sortedSections, documentSections, handleSetSectionsOrder, handleMoveItem, reset]);

  const handleDragCancel = useCallback(() => reset(), [reset]);

  const activeBoardSection = activeBoardId && liveSections
    ? liveSections.find(s => s._id === activeBoardId) ?? null
    : null;

  let activeItem: LiveItem | null = null;
  if (activeItemId && liveSections) {
    for (const s of liveSections) {
      const found = s.items.find(it => it._id === activeItemId);
      if (found) { activeItem = found; break; }
    }
  }

  return {
    liveSections,
    activeBoardId,
    activeItemId,
    activeBoardSection,
    activeItem,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleDragCancel
  };
}
