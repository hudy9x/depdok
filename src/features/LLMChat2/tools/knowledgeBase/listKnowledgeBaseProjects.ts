import { getDefaultStore } from "jotai";

import { listProjects, ProjectSummary } from "@/api-client/knowledge-base";
import { workspaceRootAtom } from "@/features/FileExplorer/store";

export interface ListKnowledgeBaseProjectsArgs {
  query?: string;
}

export interface FormattedProjectItem {
  projectId: string;
  groupId?: string;
  title: string;
  documentCount: number;
  isCurrent: boolean;
}

export interface ListKnowledgeBaseProjectsResult {
  totalFound: number;
  currentWorkspace: string | null;
  projects: FormattedProjectItem[];
  groups?: FormattedProjectItem[];
  instruction: string;
}

export async function listKnowledgeBaseProjectsTool(
  args: ListKnowledgeBaseProjectsArgs
): Promise<ListKnowledgeBaseProjectsResult> {
  const store = getDefaultStore();
  const workspaceRoot = store.get(workspaceRootAtom);
  const normalizedCurrent = workspaceRoot?.trim().replace(/[/\\]+$/, "") || null;

  const rawProjects: ProjectSummary[] = await listProjects(args.query);

  const formattedProjects: FormattedProjectItem[] = rawProjects.map((p) => {
    const normalizedId = p.projectId.trim().replace(/[/\\]+$/, "");
    const isCurrent = normalizedCurrent !== null && normalizedId === normalizedCurrent;

    return {
      projectId: p.projectId,
      groupId: p.projectId,
      title: p.title,
      documentCount: p.documentCount,
      isCurrent,
    };
  });

  return {
    totalFound: formattedProjects.length,
    currentWorkspace: workspaceRoot,
    projects: formattedProjects,
    groups: formattedProjects,
    instruction:
      "Use the exact 'projectId' of the target project as the 'project' parameter when invoking 'search_knowledge_base'. Items marked with isCurrent: true represent the currently active project folder.",
  };
}

export const listKnowledgeBaseGroupsTool = listKnowledgeBaseProjectsTool;
export type ListKnowledgeBaseGroupsArgs = ListKnowledgeBaseProjectsArgs;
export type ListKnowledgeBaseGroupsResult = ListKnowledgeBaseProjectsResult;
export type FormattedGroupItem = FormattedProjectItem;
