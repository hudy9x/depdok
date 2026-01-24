import { useEffect, useState } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { TodoSection, todoRender, todoSerializer } from "@/features/PreviewTodo/todoRenderer";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, X, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { editorStateAtom, markAsDirtyAtom } from "@/stores/EditorStore";
import { draftService } from "@/lib/indexeddb";
import { useDebouncedCallback } from "use-debounce";

interface TodoPreviewProps {
  content: string;
  onContentChange?: (content: string) => void;
  editable?: boolean;
}

export function TodoPreview({ content, onContentChange, editable = false }: TodoPreviewProps) {
  const editorState = useAtomValue(editorStateAtom);
  const markAsDirty = useSetAtom(markAsDirtyAtom);
  const [sections, setSections] = useState<TodoSection[]>([]);
  const [newSectionTitle, setNewSectionTitle] = useState("");
  const [isAddingSection, setIsAddingSection] = useState(false);

  useEffect(() => {
    setSections(todoRender(content));
  }, [content]);

  // Debounced draft save (only when editable)
  const debouncedSaveDraft = useDebouncedCallback(async (newContent: string) => {
    if (!editorState.filePath || !editable) return;
    await draftService.saveDraft(editorState.filePath, newContent);
    markAsDirty();
  }, 500);

  const updateContent = (newSections: TodoSection[]) => {
    setSections(newSections);
    const serializedContent = todoSerializer(newSections);

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
    const newSections = [...sections];
    newSections[sectionIndex].items[itemIndex].checked = !newSections[sectionIndex].items[itemIndex].checked;
    updateContent(newSections);
  };

  const handleUpdateItemTitle = (sectionIndex: number, itemIndex: number, newTitle: string) => {
    if (!editable) return;
    const newSections = [...sections];
    newSections[sectionIndex].items[itemIndex].title = newTitle;
    updateContent(newSections);
  };

  const handleAddItem = (sectionIndex: number) => {
    if (!editable) return;
    const newSections = [...sections];
    newSections[sectionIndex].items.push({ title: "New Item", checked: false });
    updateContent(newSections);
  };

  const handleRemoveItem = (sectionIndex: number, itemIndex: number) => {
    if (!editable) return;
    const newSections = [...sections];
    newSections[sectionIndex].items.splice(itemIndex, 1);
    updateContent(newSections);
  };

  const handleAddSection = () => {
    if (!editable || !newSectionTitle.trim()) return;
    const newSections = [...sections];
    newSections.push({ title: newSectionTitle, items: [] });
    setNewSectionTitle("");
    setIsAddingSection(false);
    updateContent(newSections);
  };

  const handleRemoveSection = (sectionIndex: number) => {
    if (!editable) return;
    const newSections = [...sections];
    newSections.splice(sectionIndex, 1);
    updateContent(newSections);
  };

  const handleSectionTitleChange = (sectionIndex: number, newTitle: string) => {
    if (!editable) return;
    const newSections = [...sections];
    newSections[sectionIndex].title = newTitle;
    updateContent(newSections);
  }

  return (
    <div className="h-full w-full overflow-x-auto p-4 bg-background">
      <div className="flex h-full gap-4 items-start">
        {sections.map((section, sectionIndex) => (
          <Card key={sectionIndex} className="w-80 border-border pb-0 pt-4 flex-shrink-0 max-h-full flex flex-col gap-2 bg-card">
            <CardHeader className="px-4 flex flex-row items-center justify-between space-y-0 group">
              <Input
                value={section.title}
                onChange={(e) => handleSectionTitleChange(sectionIndex, e.target.value)}
                className="font-semibold text-lg bg-transparent shadow-none border-transparent focus:border-input h-auto p-1 py-0 mr-2"
                disabled={!editable}
              />
              {editable && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                  onClick={() => handleRemoveSection(sectionIndex)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </CardHeader>
            <CardContent className="px-2 pb-2 flex-1 overflow-y-auto overflow-x-hidden flex flex-col gap-2">
              <ScrollArea className="flex-1 pr-2 -mr-2">
                <div className="flex flex-col gap-2 p-1">
                  {section.items.map((item, itemIndex) => (
                    <div
                      key={itemIndex}
                      className="group flex items-start gap-2 p-2 rounded-md border border-border bg-card hover:bg-accent/50 transition-colors"
                    >
                      <Checkbox
                        checked={item.checked}
                        onCheckedChange={() => handleToggleItem(sectionIndex, itemIndex)}
                        disabled={!editable}
                        className="mt-1"
                      />
                      <Input
                        value={item.title}
                        onChange={(e) =>
                          handleUpdateItemTitle(sectionIndex, itemIndex, e.target.value)
                        }
                        className={cn(
                          "flex-1 h-auto p-0 border-0 bg-transparent shadow-none focus-visible:ring-0 px-1 min-h-[1.5rem]",
                          item.checked && "line-through text-muted-foreground"
                        )}
                        disabled={!editable}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.currentTarget.blur()
                          }
                        }}
                      />
                      {editable && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                          onClick={() => handleRemoveItem(sectionIndex, itemIndex)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
              {editable && (
                <Button
                  variant="ghost"
                  className="w-full justify-start mt-2"
                  onClick={() => handleAddItem(sectionIndex)}
                >
                  <Plus className="mr-2 h-4 w-4" /> Add Item
                </Button>
              )}
            </CardContent>
          </Card>
        ))}

        {editable && (
          <div className="w-80 flex-shrink-0">
            {isAddingSection ? (
              <Card className="bg-card/50">
                <CardContent className="p-3 space-y-2">
                  <Input
                    placeholder="New Section Title"
                    value={newSectionTitle}
                    onChange={(e) => setNewSectionTitle(e.target.value)}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddSection();
                      if (e.key === 'Escape') setIsAddingSection(false);
                    }}
                  />
                  <div className="flex gap-2 justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsAddingSection(false)}
                    >
                      Cancel
                    </Button>
                    <Button size="sm" onClick={handleAddSection}>
                      Add Section
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Button
                variant="outline"
                className="w-full h-auto py-3 border-dashed"
                onClick={() => setIsAddingSection(true)}
              >
                <Plus className="mr-2 h-4 w-4" /> Add Section
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
