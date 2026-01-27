import { useEffect } from "react";
import { useSetAtom } from "jotai";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { toast } from "sonner";
import { createTabAtom } from "@/stores/TabStore";

const supportedFileTypes = ["md", "mmd", "txt", "pu", "puml", "todo"];

export function AppMenuListener() {
  const createTab = useSetAtom(createTabAtom);

  useEffect(() => {
    const unlisten = listen("menu://open-file", async () => {
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
          // The Editor's useEffect will handle the URL sync
          const fileName = selected.split("/").pop() || "Untitled";
          createTab({ filePath: selected, fileName, switchTo: true });
        }
      } catch (error) {
        console.error("Error opening file:", error);
        toast.error("Failed to open file");
      }
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [createTab]);

  return null;
}
