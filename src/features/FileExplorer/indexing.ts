import { atom } from "jotai";
import { toast } from "sonner";
import { FileIndexingState, listDirectory, readFileContent } from "./api";
import { setFileIndexingStateAtom, workspaceRootAtom } from "./store";
import { indexMarkdownDocumentSections } from "@/api-client/knowledge-base";

const LARGE_INDEXING_THRESHOLD = 10;
const MINIMUM_STATE_DURATION_MS = 400;

export interface IndexingProgress {
  status: "running" | "cancelling";
  total: number;
  completed: number;
  currentPath: string | null;
}

export const indexingProgressAtom = atom<IndexingProgress | null>(null);
const indexingCancelRequestedAtom = atom(false);

function isIndexableMarkdown(path: string): boolean {
  const fileName = path.split(/[/\\]/).pop()?.toLowerCase() ?? "";
  return (
    (fileName.endsWith(".md") || fileName.endsWith(".markdown")) &&
    fileName !== "knowledge-graph.md"
  );
}

async function collectMarkdownFiles(
  path: string,
  isFolder: boolean,
): Promise<string[]> {
  if (!isFolder) {
    return isIndexableMarkdown(path) ? [path] : [];
  }

  const files: string[] = [];
  const entries = await listDirectory(path);
  for (const entry of entries) {
    if (entry.is_dir) {
      const directoryName = entry.name.toLowerCase();
      if (
        directoryName === ".git" ||
        directoryName === "node_modules" ||
        directoryName === ".depdok" ||
        directoryName.startsWith(".depdok")
      ) {
        continue;
      }
      files.push(...(await collectMarkdownFiles(entry.path, true)));
    } else if (isIndexableMarkdown(entry.path)) {
      files.push(entry.path);
    }
  }
  return files;
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function keepStateVisible(startedAt: number): Promise<void> {
  const remaining = MINIMUM_STATE_DURATION_MS - (Date.now() - startedAt);
  if (remaining > 0) {
    await wait(remaining);
  }
}

async function confirmLargeIndexing(fileCount: number): Promise<boolean> {
  return await new Promise<boolean>((resolve) => {
    let settled = false;
    let toastId: string | number;
    const settle = (confirmed: boolean) => {
      if (settled) return;
      settled = true;
      toast.dismiss(toastId);
      resolve(confirmed);
    };

    toastId = toast.warning(`Index ${fileCount} Markdown files?`, {
      description:
        "This may take a while and will use the configured embedding model.",
      duration: Infinity,
      action: {
        label: "Index",
        onClick: () => settle(true),
      },
      cancel: {
        label: "Cancel",
        onClick: () => settle(false),
      },
    });
  });
}

export const cancelIndexingAtom = atom(null, (_get, set) => {
  set(indexingCancelRequestedAtom, true);
  const progress = _get(indexingProgressAtom);
  if (progress?.status === "running") {
    set(indexingProgressAtom, { ...progress, status: "cancelling" });
  }
});

export const startIndexingAtom = atom(
  null,
  async (get, set, target: { path: string; isFolder: boolean }) => {
    if (get(indexingProgressAtom)) {
      toast.info("Indexing is already in progress.");
      return;
    }

    let files: string[];
    try {
      files = await collectMarkdownFiles(target.path, target.isFolder);
    } catch (error) {
      console.error("Failed to collect files for indexing:", error);
      toast.error("Could not read the selected item.");
      return;
    }

    if (files.length === 0) {
      toast.info(
        target.isFolder
          ? "No Markdown files found in this folder."
          : "Only Markdown files can be indexed.",
      );
      return;
    }

    if (
      files.length > LARGE_INDEXING_THRESHOLD &&
      !(await confirmLargeIndexing(files.length))
    ) {
      return;
    }

    set(indexingCancelRequestedAtom, false);
    set(indexingProgressAtom, {
      status: "running",
      total: files.length,
      completed: 0,
      currentPath: null,
    });
    if (target.isFolder) {
      set(setFileIndexingStateAtom, {
        path: target.path,
        state: FileIndexingState.Indexing,
      });
    }

    const workspaceRoot = get(workspaceRootAtom);
    let indexedCount = 0;

    for (const filePath of files) {
      if (get(indexingCancelRequestedAtom)) break;

      const startedAt = Date.now();
      const progress = get(indexingProgressAtom);
      set(
        indexingProgressAtom,
        progress ? { ...progress, currentPath: filePath } : progress,
      );
      set(setFileIndexingStateAtom, {
        path: filePath,
        state: FileIndexingState.Indexing,
      });

      try {
        const content = await readFileContent(filePath);
        const title = filePath.split(/[/\\]/).pop() ?? filePath;
        await indexMarkdownDocumentSections(
          filePath,
          title,
          content,
          workspaceRoot ? [workspaceRoot] : [],
        );
        indexedCount++;
      } catch (error) {
        console.error(`Failed to index ${filePath}:`, error);
        toast.error(
          `Failed to index ${filePath.split(/[/\\]/).pop() ?? filePath}`,
        );
      }

      await keepStateVisible(startedAt);
      if (!get(indexingCancelRequestedAtom)) {
        set(setFileIndexingStateAtom, {
          path: filePath,
          state: FileIndexingState.Done,
        });
        await wait(MINIMUM_STATE_DURATION_MS);
      }
      set(setFileIndexingStateAtom, {
        path: filePath,
        state: FileIndexingState.Idle,
      });
      const updatedProgress = get(indexingProgressAtom);
      if (updatedProgress) {
        set(indexingProgressAtom, {
          ...updatedProgress,
          completed: updatedProgress.completed + 1,
          currentPath: null,
        });
      }
    }

    const wasCancelled = get(indexingCancelRequestedAtom);
    if (!wasCancelled) {
      if (target.isFolder) {
        set(setFileIndexingStateAtom, {
          path: target.path,
          state: FileIndexingState.Done,
        });
      }
      await wait(MINIMUM_STATE_DURATION_MS);
    }
    if (target.isFolder) {
      set(setFileIndexingStateAtom, {
        path: target.path,
        state: FileIndexingState.Idle,
      });
    }
    set(indexingProgressAtom, null);
    set(indexingCancelRequestedAtom, false);
    if (wasCancelled) {
      toast.info(
        `Indexing cancelled after ${indexedCount} file${indexedCount === 1 ? "" : "s"}.`,
      );
    }
  },
);
