import { useEffect } from "react";
import { useSetAtom } from "jotai";
import { useNavigate } from "react-router-dom";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { toast } from "sonner";
import { createTabAtom, createUntitledTabAtom } from "@/stores/TabStore";

const supportedFileTypes = ["md", "mmd", "txt", "pu", "puml", "todo"];

export function AppMenuListener() {
  const createTab = useSetAtom(createTabAtom);
  const createUntitledTab = useSetAtom(createUntitledTabAtom);
  const navigate = useNavigate();

  useEffect(() => {
    const listeners: Promise<() => void>[] = [];

    // Open file listener
    listeners.push(
      listen("menu://open-file", async () => {
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
      })
    );

    // New file listeners
    const fileTypes = [
      { extension: "md", event: "menu://new-file-md" },
      { extension: "mmd", event: "menu://new-file-mmd" },
      { extension: "todo", event: "menu://new-file-todo" },
      { extension: "pu", event: "menu://new-file-pu" },
      { extension: "txt", event: "menu://new-file-txt" },
    ];

    fileTypes.forEach(({ extension, event }) => {
      listeners.push(
        listen(event, () => {
          createUntitledTab(`Untitled.${extension}`);
          // Navigate to editor if not already there
          if (window.location.pathname !== "/editor") {
            navigate("/editor");
          }
        })
      );
    });

    // Back navigation listener
    listeners.push(
      listen("menu://back", () => {
        navigate("/home");
      })
    );

    return () => {
      listeners.forEach((unlisten) => {
        unlisten.then((fn) => fn());
      });
    };
  }, [createTab, createUntitledTab, navigate]);

  return null;
}
