import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

interface AddSectionBoardProps {
  onAddSection: (title: string) => void;
}

export function AddSectionBoard({ onAddSection }: AddSectionBoardProps) {
  const [newSectionTitle, setNewSectionTitle] = useState("");
  const [isAddingSection, setIsAddingSection] = useState(false);

  const handleAddSectionClick = () => {
    if (!newSectionTitle.trim()) return;
    onAddSection(newSectionTitle);
    setNewSectionTitle("");
    setIsAddingSection(false);
  };

  return (
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
                if (e.key === "Enter") handleAddSectionClick();
                if (e.key === "Escape") setIsAddingSection(false);
              }}
            />
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={() => setIsAddingSection(false)}>
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
          className="w-full h-auto mt-3 py-2 border-dashed"
          onClick={() => setIsAddingSection(true)}
        >
          <Plus className="mr-2 h-4 w-4" /> Add Section
        </Button>
      )}
    </div>
  );
}
