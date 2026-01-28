import { useEffect } from "react";
import { useSetAtom } from "jotai";
import { useNavigate } from "react-router-dom";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { toast } from "sonner";
import { createTabAtom } from "@/stores/TabStore";

const supportedFileTypes = ["md", "mmd", "txt", "pu", "puml", "todo"];

export function AppMenuListener() {
  const createTab = useSetAtom(createTabAtom);
  const navigate = useNavigate();

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
          const fileName = selected.split("/").pop() || "Untitled";
          createTab({ filePath: selected, fileName, switchTo: true });
          // Navigate to editor
          navigate("/editor");
        }
      } catch (error) {
        console.error("Error opening file:", error);
        toast.error("Failed to open file");
      }
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [createTab, navigate]);

  return null;
}
