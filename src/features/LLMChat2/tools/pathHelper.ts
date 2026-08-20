import { getDefaultStore } from "jotai";
import { workspaceRootAtom } from "@/features/FileExplorer/store";

export function resolvePath(inputPath: string): string {
  const cleanInput = inputPath.trim();
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

export function getParentDir(path: string): string {
  const store = getDefaultStore();
  const workspaceRoot = store.get(workspaceRootAtom);
  const parts = path.split(/[/\\]/);
  parts.pop();
  const parent = parts.join("/");
  return parent || workspaceRoot || "";
}
