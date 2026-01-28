import { useEffect, useState } from "react";
import { useSetAtom } from "jotai";
import { useNavigate } from "react-router-dom";
import { open, save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { cn } from "@/lib/utils";
import { Titlebar } from "@/features/Titlebar";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { FileText, FilePlus } from "lucide-react";
import { toast } from "sonner";
import { createTabAtom } from "@/stores/TabStore";

const supportedFileTypes = ["md", "mmd", "txt", "pu", "puml", "todo"];

export default function Home() {
  const [isVisible, setIsVisible] = useState(false);
  const createTab = useSetAtom(createTabAtom);
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
            extensions: supportedFileTypes,
          },
        ],
      });

      if (selected && typeof selected === "string") {
        // Add to tab store and switch to it
        const fileName = selected.split("/").pop() || "Untitled";
        createTab({ filePath: selected, fileName, switchTo: true });
        // Navigate to editor
        navigate("/editor");
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
            extensions: supportedFileTypes,
          },
        ],
      });

      if (selected) {
        // Create empty file
        await writeTextFile(selected, "");

        // Add to tab store and switch to it
        const fileName = selected.split("/").pop() || "Untitled";
        createTab({ filePath: selected, fileName, switchTo: true });

        // Navigate to editor
        navigate("/editor");

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

      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FileText className="w-12 h-12" />
          </EmptyMedia>
          <EmptyTitle className="text-2xl font-bold">Welcome to Depdok</EmptyTitle>
          <EmptyDescription className="w-[440px]">
            A documentation editor for developers who write technical docs.
            Get started by opening an existing file or creating a new one.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent className="flex-row justify-center gap-3">
          <Button size="lg" onClick={handleOpenFile} className="gap-2">
            <FileText className="w-5 h-5" />
            Open File
          </Button>
          <Button size="lg" variant="outline" onClick={handleCreateNew} className="gap-2">
            <FilePlus className="w-5 h-5" />
            Create New
          </Button>
        </EmptyContent>
        <p className="text-sm text-muted-foreground mt-4">
          Supports Markdown, Mermaid, PlantUML, and Text files
        </p>
      </Empty>
    </main>
  );
}
