import { TodoSection, TodoItem as TodoItemType } from "./todoRenderer";

// ─── Live types ───────────────────────────────────────────────────────────────
// Each live section/item carries:
//   _id        — unique dnd ID for this drag session
//   _origIdx   — index in the ORIGINAL sortedSections (sections) or items array
//                so we can always map back to document.sections on drop

export interface LiveItem extends TodoItemType {
  _id: string;
  _origSectionIdx: number; // original section index in sortedSections
  _origItemIdx: number;    // original item index in that section
}

export interface LiveSection extends Omit<TodoSection, "items"> {
  _id: string;
  _origIdx: number; // original index in sortedSections
  _docIdx: number;  // original index in document.sections
  items: LiveItem[];
}

// ─── Deterministic IDs ────────────────────────────────────────────────────────
// Use index-based IDs to ensure the static render matches the drag start state.
export const getBoardId = (idx: number) => `board-${idx}`;
export const getItemId = (sIdx: number, iIdx: number) => `item-${sIdx}-${iIdx}`;

export function buildLiveSections(sortedSections: TodoSection[], documentSections: TodoSection[]): LiveSection[] {
  return sortedSections.map((section, si) => ({
    ...section,
    _id: getBoardId(si),
    _origIdx: si,
    _docIdx: documentSections.indexOf(section),
    items: section.items.map((item, ii) => ({
      ...item,
      _id: getItemId(si, ii),
      _origSectionIdx: si,
      _origItemIdx: ii,
    })),
  }));
}
