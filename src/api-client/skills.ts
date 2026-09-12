import { invoke } from '@tauri-apps/api/core';

export interface Skill {
  name: string;
  description: string;
  tools?: string[];
  body: string;
  file_path?: string;
}

export async function setupSkills(workspaceRoot: string): Promise<Skill[]> {
  return await invoke<Skill[]>('llm2_skill_setup', {
    workspaceRoot,
    workspace_root: workspaceRoot,
  });
}

export async function reloadSkills(workspaceRoot: string): Promise<Skill[]> {
  return await invoke<Skill[]>('llm2_skill_reload', {
    workspaceRoot,
    workspace_root: workspaceRoot,
  });
}

export async function listSkills(workspaceRoot: string): Promise<Skill[]> {
  return await invoke<Skill[]>('llm2_skill_list', {
    workspaceRoot,
    workspace_root: workspaceRoot,
  });
}
