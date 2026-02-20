import { useEffect, useState } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { useDebouncedCallback } from "use-debounce";
import { TodoDocument, todoRender, todoSerializer, TodoSection } from "./todoRenderer";
import { editorStateAtom, markAsDirtyAtom } from "@/stores/EditorStore";
import { draftService } from "@/lib/indexeddb";

interface UseTodoDocumentProps {
  content: string;
  editable: boolean;
  onContentChange?: (content: string) => void;
}

export function useTodoDocument({ content, editable, onContentChange }: UseTodoDocumentProps) {
  const editorState = useAtomValue(editorStateAtom);
  const markAsDirty = useSetAtom(markAsDirtyAtom);
  const [document, setDocument] = useState<TodoDocument>({ sections: [] });

  useEffect(() => {
    setDocument(todoRender(content));
  }, [content]);

  // Debounced draft save (only when editable)
  const debouncedSaveDraft = useDebouncedCallback(async (newContent: string) => {
    if (!editorState.filePath || !editable) return;
    await draftService.saveDraft(editorState.filePath, newContent);
    markAsDirty();
  }, 500);

  const updateContent = (newDocument: TodoDocument) => {
    setDocument(newDocument);
    const serializedContent = todoSerializer(newDocument);

    if (onContentChange) {
      onContentChange(serializedContent);
    }

    // Save to draft service for Ctrl/Cmd+S to work (debounced)
    if (editable) {
      debouncedSaveDraft(serializedContent);
    }
  };

  const handleToggleItem = (sectionIndex: number, itemIndex: number) => {
    if (!editable) return;
    const newDocument = { ...document };
    newDocument.sections = [...newDocument.sections];
    newDocument.sections[sectionIndex] = { ...newDocument.sections[sectionIndex] };
    newDocument.sections[sectionIndex].items = [...newDocument.sections[sectionIndex].items];
    newDocument.sections[sectionIndex].items[itemIndex] = {
      ...newDocument.sections[sectionIndex].items[itemIndex],
      checked: !newDocument.sections[sectionIndex].items[itemIndex].checked
    };
    updateContent(newDocument);
  };

  const handleUpdateItemTitle = (sectionIndex: number, itemIndex: number, newTitle: string) => {
    if (!editable) return;
    const newDocument = { ...document };
    newDocument.sections = [...newDocument.sections];
    newDocument.sections[sectionIndex] = { ...newDocument.sections[sectionIndex] };
    newDocument.sections[sectionIndex].items = [...newDocument.sections[sectionIndex].items];
    newDocument.sections[sectionIndex].items[itemIndex] = {
      ...newDocument.sections[sectionIndex].items[itemIndex],
      title: newTitle
    };
    updateContent(newDocument);
  };

  const handleUpdateItemMetadata = (sectionIndex: number, itemIndex: number, metadata: any) => {
    if (!editable) return;
    const newDocument = { ...document };
    newDocument.sections = [...newDocument.sections];
    newDocument.sections[sectionIndex] = { ...newDocument.sections[sectionIndex] };
    newDocument.sections[sectionIndex].items = [...newDocument.sections[sectionIndex].items];
    newDocument.sections[sectionIndex].items[itemIndex] = {
      ...newDocument.sections[sectionIndex].items[itemIndex],
      metadata
    };
    updateContent(newDocument);
  };

  const handleAddItem = (sectionIndex: number, metadata?: any, title?: string) => {
    if (!editable) return;
    const newDocument = { ...document };
    newDocument.sections = [...newDocument.sections];
    newDocument.sections[sectionIndex] = { ...newDocument.sections[sectionIndex] };
    newDocument.sections[sectionIndex].items = [...newDocument.sections[sectionIndex].items];
    newDocument.sections[sectionIndex].items.push({
      title: title || "New Item",
      checked: false,
      metadata: metadata || undefined
    });
    updateContent(newDocument);
  };

  const handleRemoveItem = (sectionIndex: number, itemIndex: number) => {
    if (!editable) return;
    const newDocument = { ...document };
    newDocument.sections = [...newDocument.sections];
    newDocument.sections[sectionIndex] = { ...newDocument.sections[sectionIndex] };
    newDocument.sections[sectionIndex].items = [...newDocument.sections[sectionIndex].items];
    newDocument.sections[sectionIndex].items.splice(itemIndex, 1);
    updateContent(newDocument);
  };

  const handleAddSection = (title: string) => {
    if (!editable || !title.trim()) return;
    const newDocument = { ...document };
    newDocument.sections = [...newDocument.sections];
    newDocument.sections.push({ title, items: [], metadata: {} });
    updateContent(newDocument);
  };

  const handleRemoveSection = (sectionIndex: number) => {
    if (!editable) return;
    const newDocument = { ...document };
    newDocument.sections = [...newDocument.sections];
    newDocument.sections.splice(sectionIndex, 1);
    updateContent(newDocument);
  };

  const handleSectionTitleChange = (sectionIndex: number, newTitle: string) => {
    if (!editable) return;
    const newDocument = { ...document };
    newDocument.sections = [...newDocument.sections];
    newDocument.sections[sectionIndex] = { ...newDocument.sections[sectionIndex], title: newTitle };
    updateContent(newDocument);
  };

  const handleSectionColorChange = (sectionIndex: number, color: string | undefined) => {
    if (!editable) return;
    const newDocument = { ...document };
    newDocument.sections = [...newDocument.sections];
    newDocument.sections[sectionIndex] = {
      ...newDocument.sections[sectionIndex],
      metadata: {
        ...newDocument.sections[sectionIndex].metadata,
        bg: color
      }
    };
    updateContent(newDocument);
  };

  /**
   * Update the order of all sections (boards).
   * Takes the new visual order of sections, updates their `order` metadata, and saves.
   */
  const handleSetSectionsOrder = (newSections: TodoSection[]) => {
    if (!editable) return;
    const newDocument = { ...document };

    // Update order metadata to match the new visual order
    newDocument.sections = newSections.map((section, idx) => ({
      ...section,
      metadata: { ...section.metadata, order: idx + 1 },
    }));

    updateContent(newDocument);
  };

  /**
   * Move a todo item within or across sections.
   * targetItemIndex is the index BEFORE which the item will be inserted.
   */
  const handleMoveItem = (
    sourceSectionIndex: number,
    sourceItemIndex: number,
    targetSectionIndex: number,
    targetItemIndex: number
  ) => {
    if (!editable) return;
    const newDocument = { ...document };
    newDocument.sections = newDocument.sections.map(s => ({ ...s, items: [...s.items] }));

    const sourceItems = newDocument.sections[sourceSectionIndex].items;
    const [movedItem] = sourceItems.splice(sourceItemIndex, 1);

    const targetItems = newDocument.sections[targetSectionIndex].items;
    const clampedIndex = Math.min(targetItemIndex, targetItems.length);
    targetItems.splice(clampedIndex, 0, movedItem);

    updateContent(newDocument);
  };

  const handleModeChange = (mode: 'kanban' | 'week') => {
    if (!editable) return;
    const newDocument = { ...document };
    newDocument.config = {
      ...newDocument.config,
      mode
    };
    updateContent(newDocument);
  };

  return {
    document,
    handleToggleItem,
    handleUpdateItemTitle,
    handleUpdateItemMetadata,
    handleAddItem,
    handleRemoveItem,
    handleAddSection,
    handleRemoveSection,
    handleSectionTitleChange,
    handleSectionColorChange,
    handleModeChange,
    handleSetSectionsOrder,
    handleMoveItem,
  };
}
