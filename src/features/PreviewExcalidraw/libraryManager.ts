import { appDataDir, join } from "@tauri-apps/api/path";
import { readDir, readTextFile, mkdir, writeTextFile } from "@tauri-apps/plugin-fs";
import { open } from "@tauri-apps/plugin-dialog";

const LIBRARIES_FOLDER = "excalidraw-libraries";

/**
 * Gets the persistent application data directory for Excalidraw libraries.
 * Creates the directory if it doesn't exist.
 */
export async function getLibraryDir(): Promise<string> {
  const baseDir = await appDataDir();
  const libDir = await join(baseDir, LIBRARIES_FOLDER);
  
  try {
    // Attempt to create the directory (recursive).
    // If it already exists, this does nothing or throws a harmless error depending on platform.
    await mkdir(libDir, { recursive: true });
  } catch (e) {
    // Ignore error if it already exists
  }
  
  return libDir;
}

/**
 * Prompts the user to select an .excalidrawlib file from their filesystem,
 * copies it to the persistent app data directory, and returns its parsed items.
 */
export async function installCustomLibrary() {
  const selectedPath = await open({
    multiple: false,
    filters: [{ name: "Excalidraw Library", extensions: ["excalidrawlib"] }]
  });

  if (!selectedPath || typeof selectedPath !== "string") {
    return null; // User cancelled the dialog
  }

  try {
    // Read from the selected source path
    const content = await readTextFile(selectedPath);
    
    // Create destination path in our app data folder using original filename
    const filename = selectedPath.split(/[/\\]/).pop() || "custom.excalidrawlib";
    const libDir = await getLibraryDir();
    const destPath = await join(libDir, filename);

    // Save to persistent app data directory
    await writeTextFile(destPath, content);
    console.log(`[Excalidraw] Library ${filename} successfully installed to ${destPath}`);

    // Parse and return the library items so Excalidraw can update immediately
    const parsed = JSON.parse(content);
    const items = Array.isArray(parsed.libraryItems) 
      ? parsed.libraryItems 
      : Array.isArray(parsed.library) 
        ? parsed.library 
        : [];
    return items;
  } catch (err) {
    console.error("[Excalidraw] Failed to install custom library:", err);
    return [];
  }
}

/**
 * Scans the persistent app data directory for all installed libraries
 * and merges their contents.
 */
export async function loadAllInstalledLibraries() {
  const libDir = await getLibraryDir();
  let allItems: any[] = [];
  
  try {
    const entries = await readDir(libDir);
    
    for (const entry of entries) {
      if (entry.name && entry.name.endsWith(".excalidrawlib")) {
        try {
          const filePath = await join(libDir, entry.name);
          const content = await readTextFile(filePath);
          const parsed = JSON.parse(content);
          
          if (Array.isArray(parsed.libraryItems)) {
            allItems = allItems.concat(parsed.libraryItems);
          } else if (Array.isArray(parsed.library)) {
            allItems = allItems.concat(parsed.library);
          }
        } catch (fileErr) {
          console.error(`[Excalidraw] Failed to parse library ${entry.name}:`, fileErr);
        }
      }
    }
  } catch (err) {
    console.error("[Excalidraw] Failed to read library directory:", err);
  }
  
  return allItems;
}
