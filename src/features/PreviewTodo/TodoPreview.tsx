import { useState } from "react";
import { useTodoDocument } from "./useTodoDocument";
import { TodoItem } from "./TodoItem";
import { ColorSelector } from "./ColorSelector";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Trash2 } from "lucide-react";

interface TodoPreviewProps {
  content: string;
  onContentChange?: (content: string) => void;
  editable?: boolean;
}

export function TodoPreview({ content, onContentChange, editable = false }: TodoPreviewProps) {
  const [newSectionTitle, setNewSectionTitle] = useState("");
  const [isAddingSection, setIsAddingSection] = useState(false);

  const {
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
  } = useTodoDocument({ content, editable, onContentChange });

  const handleAddSectionClick = () => {
    if (!newSectionTitle.trim()) return;
    handleAddSection(newSectionTitle);
    setNewSectionTitle("");
    setIsAddingSection(false);
  };

  // Sort sections by order metadata
  const sortedSections = [...document.sections].sort((a, b) => {
    const orderA = a.metadata?.order ?? 999;
    const orderB = b.metadata?.order ?? 999;
    return orderA - orderB;
  });

  return (
    <div className="h-full w-full overflow-x-auto p-4 bg-background">
      <div className="flex h-full gap-4 items-start">
        {sortedSections.map((section) => {
          // Find the original index for updates
          const sectionIndex = document.sections.indexOf(section);
          const bgColor = section.metadata?.bg;
          // const theme = getThemeByBg(bgColor);

          return (
            <Card
              key={sectionIndex}
              className="w-80 pb-0 pt-4 flex-shrink-0 max-h-full flex flex-col gap-2 bg-board border-board-border"
              style={{
                // backgroundColor: bgColor,
                // borderColor: theme?.border,
                // borderWidth: theme ? '1px' : '1px',
              }}
            >
              <CardHeader className="px-4 flex flex-row items-center justify-between space-y-0 group">
                <ColorSelector
                  currentColor={bgColor}
                  onColorChange={(color) => handleSectionColorChange(sectionIndex, color)}
                  editable={editable}
                />
                <Input
                  value={section.title}
                  onChange={(e) => handleSectionTitleChange(sectionIndex, e.target.value)}
                  style={{ backgroundColor: "transparent" }}
                  className="font-semibold text-lg bg-transparent shadow-none border-transparent focus:border-input h-auto p-1 py-0"
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
              <CardContent className="px-2 pb-2 flex-1 overflow-hidden h-full flex flex-col gap-2">
                <ScrollArea className="flex-1 max-h-[calc(100vh-48px)]">
                  <div className="flex flex-col gap-3 pt-1">
                    {section.items.map((item, itemIndex) => (
                      <TodoItem
                        key={itemIndex}
                        item={item}
                        sectionIndex={sectionIndex}
                        itemIndex={itemIndex}
                        config={document.config}
                        editable={editable}
                        onToggle={handleToggleItem}
                        onUpdateTitle={handleUpdateItemTitle}
                        onUpdateMetadata={handleUpdateItemMetadata}
                        onRemove={handleRemoveItem}
                      />
                    ))}
                  </div>
                </ScrollArea>
                {editable && (
                  <Button
                    variant="ghost"
                    className="w-full justify-start mt-1 hover:bg-transparent text-muted-foreground"
                    onClick={() => handleAddItem(sectionIndex)}
                  >
                    <Plus className="h-4 w-4" /> Add Item
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}

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
                      if (e.key === 'Enter') handleAddSectionClick();
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
                    <Button size="sm" onClick={handleAddSectionClick}>
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
