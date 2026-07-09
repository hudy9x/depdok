import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";

export async function getCurrentBranch(workingDir: string): Promise<string> {
    try {
        const branch = await invoke<string>("get_current_branch", { workingDir });
        return branch;
    } catch (error) {
        console.error("Failed to get current branch:", error);
        return "";
    }
}

export async function getAllBranches(workingDir: string): Promise<string[]> {
    try {
        const branches = await invoke<string[]>("get_all_branches", { workingDir });
        return branches;
    } catch (error) {
        console.error("Failed to get all branches:", error);
        return [];
    }
}

export async function switchBranch(workingDir: string, branchName: string): Promise<boolean> {
    try {
        await invoke<string>("switch_branch", { workingDir, branch: branchName });
        return true;
    } catch (error) {
        console.error("Failed to switch branch:", error);
        return false;
    }
}

export async function getGitStatus(workingDir: string): Promise<Record<string, string>> {
    try {
        const statusMap = await invoke<Record<string, string>>("get_git_status", { workingDir });
        return statusMap;
    } catch (error) {
        console.error("Failed to get git status:", error);
        return {};
    }
}

export function normalizePath(p: string): string {
    return p.replace(/\\/g, '/');
}

export function getGitStatusColor(status: string | undefined): string {
    if (!status) return "";

    switch (status) {
        case "modified":
            return "text-amber-500 dark:text-amber-400";
        case "added":
        case "untracked":
            return "text-emerald-600 dark:text-emerald-400";
        case "deleted":
            return "text-rose-600 dark:text-rose-400";
        case "renamed":
            return "text-blue-500 dark:text-blue-400";
        case "copied":
            return "text-purple-500 dark:text-purple-400";
        default:
            return "";
    }
}

/**
 * Check if a folder or any of its children have a specific git status
 * This is used to apply colors to folders when their contents are modified/added
 */
export function getFolderGitStatus(
    folderPath: string,
    gitStatus: Record<string, string>
): string | undefined {
    const normalizedFolder = normalizePath(folderPath);

    // Check if the folder itself has a status (with or without trailing slash)
    const directEntry = Object.entries(gitStatus).find(([path]) => {
        const normPath = normalizePath(path);
        return normPath === normalizedFolder || normPath === `${normalizedFolder}/` || `${normPath}/` === normalizedFolder;
    });

    if (directEntry) {
        return directEntry[1];
    }

    // Check if any children have status
    const folderPathWithSlash = normalizedFolder.endsWith('/') 
        ? normalizedFolder 
        : `${normalizedFolder}/`;

    let hasModified = false;
    let hasAddedOrUntracked = false;
    let hasDeleted = false;

    for (const [path, status] of Object.entries(gitStatus)) {
        const normalizedChildPath = normalizePath(path);
        if (normalizedChildPath.startsWith(folderPathWithSlash)) {
            // Prioritize untracked/added over modified, and modified over deleted
            if (status === "added" || status === "untracked") {
                hasAddedOrUntracked = true;
            } else if (status === "modified" || status === "renamed" || status === "copied") {
                hasModified = true;
            } else if (status === "deleted") {
                hasDeleted = true;
            }
        }
    }

    if (hasAddedOrUntracked) return "untracked";
    if (hasModified) return "modified";
    if (hasDeleted) return "deleted";

    return undefined;
}

/**
 * Get the effective git status for a file or folder
 * If the item doesn't have a direct status, check if any parent folder has a status
 * This ensures children of newly added folders inherit the green color
 */
export function getEffectiveGitStatus(
    itemPath: string,
    isDir: boolean,
    gitStatus: Record<string, string>
): string | undefined {
    // For directories, use the folder-specific logic
    if (isDir) {
        return getFolderGitStatus(itemPath, gitStatus);
    }

    const normalizedItemPath = normalizePath(itemPath);

    // For files, first check direct status
    const directEntry = Object.entries(gitStatus).find(
        ([path]) => normalizePath(path) === normalizedItemPath
    );
    if (directEntry) {
        return directEntry[1];
    }

    // If no direct status, check if any parent folder is untracked/added
    // This handles children of newly added folders
    let currentPath = normalizedItemPath;
    while (currentPath.includes('/')) {
        const lastSlash = currentPath.lastIndexOf('/');
        const parentPath = currentPath.substring(0, lastSlash);

        // Check if parentPath has directly untracked status (e.g. parentPath or parentPath/)
        const parentEntry = Object.entries(gitStatus).find(([path]) => {
            const normPath = normalizePath(path);
            return normPath === parentPath || normPath === `${parentPath}/`;
        });

        if (parentEntry && (parentEntry[1] === "untracked" || parentEntry[1] === "added")) {
            return parentEntry[1];
        }

        currentPath = parentPath;
    }

    return undefined;
}

export async function gitPull(workingDir: string): Promise<{ success: boolean; output: string }> {
    try {
        const output = await invoke<string>("git_pull", { workingDir });
        return { success: true, output };
    } catch (error) {
        console.error("Failed to git pull:", error);
        return { success: false, output: String(error) };
    }
}

export async function hasGitUpstream(workingDir: string): Promise<boolean> {
    try {
        return await invoke<boolean>("has_git_upstream", { workingDir });
    } catch (error) {
        console.error("Failed to determine git upstream:", error);
        return false;
    }
}

export async function getGitSyncStatus(
    workingDir: string
): Promise<{ ahead: number; behind: number }> {
    try {
        const [ahead, behind] = await invoke<[number, number]>("get_git_sync_status", { workingDir });
        return { ahead, behind };
    } catch (error) {
        console.error("Failed to get git sync status:", error);
        return { ahead: 0, behind: 0 };
    }
}

export interface GitWorkingTreeSummary {
    changed: number;
    new: number;
    deleted: number;
}

export function summarizeGitStatus(statusMap: Record<string, string>): GitWorkingTreeSummary {
    return Object.values(statusMap).reduce<GitWorkingTreeSummary>(
        (summary, status) => {
            switch (status) {
                case "added":
                case "untracked":
                    summary.new += 1;
                    break;
                case "deleted":
                    summary.deleted += 1;
                    break;
                case "modified":
                case "renamed":
                case "copied":
                    summary.changed += 1;
                    break;
                default:
                    break;
            }

            return summary;
        },
        { changed: 0, new: 0, deleted: 0 }
    );
}

export async function startWatchingGit(workspaceRoot: string): Promise<void> {
    try {
        await invoke("start_watching_git", { workspaceRoot });
    } catch (error) {
        console.error("Failed to start watching git:", error);
    }
}

export async function stopWatchingGit(): Promise<void> {
    try {
        await invoke("stop_watching_git");
    } catch (error) {
        console.error("Failed to stop watching git:", error);
    }
}

export async function onGitChanged(
    callback: (workspaceRoot: string) => void
): Promise<UnlistenFn> {
    return await listen<string>("git-changed", (event) => {
        callback(event.payload);
    });
}

export async function isGitRepository(workingDir: string): Promise<boolean> {
    try {
        const isGit = await invoke<boolean>("is_git_repository", { workingDir });
        return isGit;
    } catch (error) {
        console.error("Failed to check if git repository:", error);
        return false;
    }
}

export interface GitRefInfo {
    name: string;
    ref_type: "branch" | "tag";
    date: string;
    author: string;
    subject: string;
}

export async function getGitRefs(workingDir: string): Promise<GitRefInfo[]> {
    try {
        const refs = await invoke<GitRefInfo[]>("get_git_refs", { workingDir });
        return refs;
    } catch (error) {
        console.error("Failed to get git refs:", error);
        return [];
    }
}

export async function createBranch(
    workingDir: string,
    branchName: string,
    baseBranch?: string
): Promise<{ success: boolean; output: string }> {
    try {
        const output = await invoke<string>("create_branch", {
            workingDir,
            branchName,
            baseBranch: baseBranch || null,
        });
        return { success: true, output };
    } catch (error) {
        console.error("Failed to create branch:", error);
        return { success: false, output: String(error) };
    }
}

export async function checkoutDetached(
    workingDir: string,
    name: string
): Promise<{ success: boolean; output: string }> {
    try {
        const output = await invoke<string>("checkout_detached", {
            workingDir,
            name,
        });
        return { success: true, output };
    } catch (error) {
        console.error("Failed to checkout detached:", error);
        return { success: false, output: String(error) };
    }
}



