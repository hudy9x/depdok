import { useEffect, useState } from "react";
import { useSetAtom, useAtomValue } from "jotai";
import { useNavigate } from "react-router-dom";
import { open } from "@tauri-apps/plugin-dialog";
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
import { FileText, Edit3 } from "lucide-react";
import { toast } from "sonner";
import { createTabAtom, createUntitledTabAtom, tabsAtom } from "@/stores/TabStore";

const supportedFileTypes = ["md", "mmd", "txt", "pu", "puml", "todo"];

export default function Home() {
  const [isVisible, setIsVisible] = useState(false);
  const createTab = useSetAtom(createTabAtom);
  const createUntitledTab = useSetAtom(createUntitledTabAtom);
  const tabs = useAtomValue(tabsAtom);
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



  const handleStartWriting = () => {
    // If there are existing tabs, just navigate to editor
    // The editor will show the last active tab
    if (tabs.length > 0) {
      navigate("/editor");
    } else {
      // No tabs - create an untitled markdown file
      createUntitledTab("Untitled.md");
      navigate("/editor");
    }
  };

  return (
    <main
      className={cn(
        "fixed top-0 left-0 z-50 w-full h-full flex flex-col items-center justify-center bg-background",
        "transition-opacity duration-600 delay-[200ms] ease-in-out fill-mode-forwards",
        isVisible ? "opacity-100" : "opacity-0"
      )}
    >
      <Titlebar />

      <Empty>
        <EmptyHeader>
          <EmptyMedia>
            <img src="/app-icon.png" alt="App Icon" className="w-24 h-24 rounded-none" />
          </EmptyMedia>
          <EmptyTitle className="text-2xl font-bold">Welcome to Depdok</EmptyTitle>
          <EmptyDescription className="w-[440px]">
            A documentation editor for developers who write technical docs.
            Get started by opening an existing file or creating a new one.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent className="flex-row justify-center gap-3">
          <Button size="lg" onClick={handleStartWriting} className="gap-2">
            <Edit3 className="w-5 h-5" />
            Start Writing
          </Button>
          <Button size="lg" variant="outline" onClick={handleOpenFile} className="gap-2">
            <FileText className="w-5 h-5" />
            Open File
          </Button>
        </EmptyContent>
        <p className="text-sm text-muted-foreground mt-4">
          Supports Markdown, Mermaid, PlantUML, and Text files
        </p>
      </Empty>
    </main>
  );
}
