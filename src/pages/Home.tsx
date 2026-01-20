import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { open, save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { cn } from "@/lib/utils";
import { Titlebar } from "@/features/Titlebar";
import { Button } from "@/components/ui/button";
import { FileText, FilePlus } from "lucide-react";
import { toast } from "sonner";

export default function Home() {
  const [isVisible, setIsVisible] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    setIsVisible(true);
  }, []);

  const handleOpenFile = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [
          {
            name: "Documentation Files",
            extensions: ["md", "mmd", "txt", "pu", "puml"],
          },
        ],
      });

      if (selected && typeof selected === "string") {
        // Navigate to editor with file path
        navigate(`/editor?path=${encodeURIComponent(selected)}`);
      }
    } catch (error) {
      console.error("Error opening file:", error);
      toast.error("Failed to open file");
    }
  };

  const handleCreateNew = async () => {
    try {
      const selected = await save({
        filters: [
          {
            name: "Documentation Files",
            extensions: ["md", "mmd", "txt", "pu", "puml"],
          },
        ],
      });

      if (selected) {
        // Create empty file
        await writeTextFile(selected, "");

        // Navigate to editor with file path
        navigate(`/editor?path=${encodeURIComponent(selected)}`);

        toast.success("File created successfully");
      }
    } catch (error) {
      console.error("Error creating file:", error);
      toast.error("Failed to create file");
    }
  };

  return (
    <main
      className={cn(
        "fixed top-0 left-0 z-50 w-full h-full flex flex-col items-center justify-center bg-secondary",
        "transition-opacity duration-600 delay-[200ms] ease-in-out fill-mode-forwards",
        isVisible ? "opacity-100" : "opacity-0"
      )}
    >
      <Titlebar />

      <div className="flex flex-col items-center gap-8 max-w-2xl px-8">
        <div className="text-center space-y-4">
          <h1 className="text-5xl font-bold tracking-tight bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent">
            Depdok
          </h1>
          <p className="text-muted-foreground text-lg">
            A documentation editor for developers who write technical docs
          </p>
        </div>

        <div className="flex gap-4 mt-4">
          <Button
            size="lg"
            onClick={handleOpenFile}
            className="gap-2 px-8"
          >
            <FileText className="w-5 h-5" />
            Open File
          </Button>

          <Button
            size="lg"
            variant="outline"
            onClick={handleCreateNew}
            className="gap-2 px-8"
          >
            <FilePlus className="w-5 h-5" />
            Create New
          </Button>
        </div>

        <div className="text-sm text-muted-foreground mt-8">
          Supports Markdown, Mermaid, PlantUML, and Text files
        </div>
      </div>
    </main>
  );
}
