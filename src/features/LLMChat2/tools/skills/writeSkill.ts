import { getDefaultStore } from "jotai";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import { workspaceRootAtom, refreshDirectoryAtom } from "@/features/FileExplorer/store";
import { availableSkillsAtom, Skill } from "../../store/LLMChat2Store";

export interface WriteSkillArgs {
  name?: string;
  content: string;
}

export interface WriteSkillResult {
  success: boolean;
  skill: Skill;
  message: string;
}

export async function writeSkillTool(args: WriteSkillArgs): Promise<WriteSkillResult> {
  const store = getDefaultStore();
  const workspaceRoot = store.get(workspaceRootAtom);

  if (!workspaceRoot) {
    throw new Error("No active workspace is open to save skills");
  }

  try {
    const createdSkill = await invoke<Skill>("llm2_write_skill", {
      workspaceRoot,
      workspace_root: workspaceRoot,
      name: args.name || "",
      content: args.content,
    });

    // Refresh skills list in store
    const updatedSkills = await invoke<Skill[]>("llm2_skill_list", {
      workspaceRoot,
      workspace_root: workspaceRoot,
    });
    store.set(availableSkillsAtom, updatedSkills);

    // Refresh FileExplorer file tree so .depdok is immediately visible
    store.set(refreshDirectoryAtom, workspaceRoot).catch(console.error);

    toast.success(`Skill saved: ${createdSkill.name}`);

    return {
      success: true,
      skill: createdSkill,
      message: `Skill '${createdSkill.name}' written successfully to .depdok/skills/${createdSkill.name}.md and cached.`,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    toast.error(`Failed to write skill: ${errorMsg}`);
    throw new Error(`Failed to write skill: ${errorMsg}`);
  }
}
