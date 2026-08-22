import { getDefaultStore } from "jotai";
import { workspaceRootAtom } from "@/features/FileExplorer/store";
import { activeTabAtom, isDummyPath } from "@/stores/TabStore";

export function resolvePath(inputPath: string): string {
  // Strip leading '@' if present (e.g. '@notes.md' -> 'notes.md')
  let cleanInput = inputPath.trim();
  if (cleanInput.startsWith("@")) {
    cleanInput = cleanInput.slice(1).trim();
  }

  const store = getDefaultStore();
  const workspaceRoot = store.get(workspaceRootAtom);

  // Check if it's already an absolute path (Unix '/' or Windows 'C:\')
  const isAbsolute =
    cleanInput.startsWith("/") ||
    (cleanInput.length > 1 && cleanInput[1] === ":");

  if (isAbsolute || !workspaceRoot) {
    return cleanInput;
  }

  const normalizedRoot = workspaceRoot.replace(/[/\\]+$/, "");
  const normalizedRelative = cleanInput.replace(/^[/\\]+/, "");
  return `${normalizedRoot}/${normalizedRelative}`;
}

export function resolveTargetFilePath(inputPath?: string): string {
  const store = getDefaultStore();
  const cleanInput = inputPath ? inputPath.trim() : "";

  // If no path specified, or explicit "active"/"current" keyword, fall back to active tab
  if (
    !cleanInput ||
    cleanInput.toLowerCase() === "active" ||
    cleanInput.toLowerCase() === "current" ||
    cleanInput.toLowerCase() === "this"
  ) {
    const activeTab = store.get(activeTabAtom);
    if (activeTab && activeTab.filePath && !isDummyPath(activeTab.filePath)) {
      return activeTab.filePath;
    }
  }

  return resolvePath(cleanInput);
}

export function getParentDir(path: string): string {
  const store = getDefaultStore();
  const workspaceRoot = store.get(workspaceRootAtom);
  const parts = path.split(/[/\\]/);
  parts.pop();
  const parent = parts.join("/");
  return parent || workspaceRoot || "";
}
