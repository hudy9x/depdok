import { useEffect, useState } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { useDebouncedCallback } from "use-debounce";
import { TodoDocument, todoRender, todoSerializer } from "./todoRenderer";
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

  const handleAddItem = (sectionIndex: number) => {
    if (!editable) return;
    const newDocument = { ...document };
    newDocument.sections = [...newDocument.sections];
    newDocument.sections[sectionIndex] = { ...newDocument.sections[sectionIndex] };
    newDocument.sections[sectionIndex].items = [...newDocument.sections[sectionIndex].items];
    newDocument.sections[sectionIndex].items.push({ title: "New Item", checked: false });
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
  };
}
