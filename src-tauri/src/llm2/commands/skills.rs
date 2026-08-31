use tauri::AppHandle;

use crate::llm2::skills::{get_cached_skills, reload_skills, setup_skills, write_skill_file, Skill};

#[tauri::command]
pub async fn llm2_skill_setup(workspace_root: String, app: AppHandle) -> Result<Vec<Skill>, String> {
  setup_skills(&workspace_root, &app)
}

#[tauri::command]
pub async fn llm2_skill_reload(workspace_root: String, app: AppHandle) -> Result<Vec<Skill>, String> {
  reload_skills(&workspace_root, &app)
}

#[tauri::command]
pub async fn llm2_skill_list(workspace_root: String, app: AppHandle) -> Result<Vec<Skill>, String> {
  get_cached_skills(&workspace_root, &app)
}

#[tauri::command]
pub async fn llm2_write_skill(
  workspace_root: String,
  name: String,
  content: String,
  app: AppHandle,
) -> Result<Skill, String> {
  write_skill_file(&workspace_root, &name, &content, &app)
}
