use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::AppHandle;
use tauri_plugin_store::StoreExt;

pub const SKILL_CREATOR_TEMPLATE: &str = include_str!("../../templates/skills/skill-creator.md");
pub const SPEC_ANALYZER_TEMPLATE: &str = include_str!("../../templates/skills/spec-analyzer.md");
pub const QA_GENERATOR_TEMPLATE: &str = include_str!("../../templates/skills/qa-generator.md");
pub const WBS_AND_LOC_ESTIMATOR_TEMPLATE: &str =
    include_str!("../../templates/skills/wbs-and-loc-estimator.md");
pub const MCP_SETUP_TEMPLATE: &str = include_str!("../../templates/skills/mcp-setup.md");

pub const BUILTIN_SKILLS: &[(&str, &str)] = &[
    ("skill-creator.md", SKILL_CREATOR_TEMPLATE),
    ("spec-analyzer.md", SPEC_ANALYZER_TEMPLATE),
    ("qa-generator.md", QA_GENERATOR_TEMPLATE),
    ("wbs-and-loc-estimator.md", WBS_AND_LOC_ESTIMATOR_TEMPLATE),
    ("mcp-setup.md", MCP_SETUP_TEMPLATE),
];

pub const KNOWN_TOOLS: &[&str] = &[
    "search_knowledge_base",
    "semantic_search",
    "search_knowledge",
    "read_markdown",
    "upsert_markdown",
    "update_markdown",
    "upsert_markdown_section",
    "update_markdown_section",
    "add_markdown_comment",
    "create_file",
    "create_folder",
    "rename_file",
    "rename_folder",
    "delete_file_or_folder",
    "delete_node",
    "move_files_or_folders",
    "move_file_or_folder",
    "move_files",
    "cut_and_move",
    "list_files",
    "list_directory",
    "traverse_directory",
    "get_user_name",
    "get_user_age",
    "get_user_country",
    "get_user_dob",
    "sum_four_digits",
    "generate_content",
    "write_skill",
];

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Skill {
    pub name: String,
    pub description: String,
    #[serde(default)]
    pub tools: Vec<String>,
    pub body: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub file_path: Option<String>,
}

/// Check if a skill name is valid (matches ^[a-z0-9-]+$)
pub fn is_valid_skill_name(name: &str) -> bool {
    if name.is_empty() {
        return false;
    }
    name.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')
}

/// Parse a raw Markdown file content with YAML frontmatter into a Skill struct
pub fn parse_skill_markdown(raw_content: &str, file_path: Option<String>) -> Result<Skill, String> {
    let trimmed = raw_content.trim();
    if !trimmed.starts_with("---") {
        return Err("Missing YAML frontmatter starting marker ('---')".to_string());
    }

    let rest = &trimmed[3..];
    let end_idx = rest.find("\n---").ok_or_else(|| "Missing YAML frontmatter ending marker ('---')".to_string())?;

    let frontmatter_str = &rest[..end_idx].trim();
    let body = rest[end_idx + 4..].trim().to_string();

    let mut name = String::new();
    let mut description = String::new();
    let mut tools = Vec::new();

    let mut in_tools_list = false;

    for line in frontmatter_str.lines() {
        let line_trimmed = line.trim();
        if line_trimmed.is_empty() || line_trimmed.starts_with('#') {
            continue;
        }

        if in_tools_list {
            if line_trimmed.starts_with('-') {
                let tool = line_trimmed.trim_start_matches('-').trim().trim_matches('"').trim_matches('\'').to_string();
                if !tool.is_empty() {
                    tools.push(tool);
                }
                continue;
            } else if !line.starts_with(' ') && !line.starts_with('\t') {
                in_tools_list = false;
            }
        }

        if let Some(colon_pos) = line_trimmed.find(':') {
            let key = line_trimmed[..colon_pos].trim();
            let val = line_trimmed[colon_pos + 1..].trim();

            match key {
                "name" => {
                    name = val.trim_matches('"').trim_matches('\'').trim().to_string();
                }
                "description" => {
                    description = val.trim_matches('"').trim_matches('\'').trim().to_string();
                }
                "tools" => {
                    if val.is_empty() {
                        in_tools_list = true;
                    } else if val.starts_with('[') && val.ends_with(']') {
                        let inner = &val[1..val.len() - 1];
                        for item in inner.split(',') {
                            let tool = item.trim().trim_matches('"').trim_matches('\'').to_string();
                            if !tool.is_empty() {
                                tools.push(tool);
                            }
                        }
                    } else {
                        let tool = val.trim_matches('"').trim_matches('\'').to_string();
                        if !tool.is_empty() {
                            tools.push(tool);
                        }
                    }
                }
                _ => {}
            }
        }
    }

    if name.is_empty() {
        return Err("Skill 'name' is required".to_string());
    }

    if !is_valid_skill_name(&name) {
        return Err(format!(
            "Invalid skill name '{}': must only contain lowercase letters, numbers, and hyphens (^[a-z0-9-]+$)",
            name
        ));
    }

    if description.is_empty() {
        return Err("Skill 'description' is required".to_string());
    }

    // Filter tools against known registry (warn/drop unknown)
    let filtered_tools: Vec<String> = tools
        .into_iter()
        .filter(|t| {
            let known = KNOWN_TOOLS.contains(&t.as_str());
            if !known {
                eprintln!("[skills] Warning: unknown tool '{}' in skill '{}' was dropped", t, name);
            }
            known
        })
        .collect();

    Ok(Skill {
        name,
        description,
        tools: filtered_tools,
        body,
        file_path,
    })
}

fn get_skills_dir(workspace_root: &str) -> PathBuf {
    let base = if workspace_root.trim().is_empty() || workspace_root == "." {
        std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."))
    } else {
        PathBuf::from(workspace_root)
    };
    base.join(".depdok").join("skills")
}

fn get_cache_store_key(workspace_root: &str) -> String {
    let clean = if workspace_root.trim().is_empty() { "default" } else { workspace_root };
    format!("skills_cache_{}", clean.replace(['/', '\\', ':', '.'], "_"))
}

/// Save skills to tauri-plugin-store
pub fn save_skills_to_cache(workspace_root: &str, skills: &[Skill], app: &AppHandle) {
    if let Ok(store) = app.store("skills_cache.json") {
        let key = get_cache_store_key(workspace_root);
        let _ = store.set(key, serde_json::to_value(skills).unwrap_or_default());
        let _ = store.save();
    }
}

/// Retrieve skills from tauri-plugin-store
pub fn load_skills_from_cache(workspace_root: &str, app: &AppHandle) -> Option<Vec<Skill>> {
    if let Ok(store) = app.store("skills_cache.json") {
        let key = get_cache_store_key(workspace_root);
        if let Some(val) = store.get(&key) {
            if let Ok(skills) = serde_json::from_value::<Vec<Skill>>(val) {
                return Some(skills);
            }
        }
    }
    None
}

/// Perform `/skill-setup`:
/// 1. Create `.depdok/` and `.depdok/skills/` if missing.
/// 2. Write built-in skill templates (e.g. `skill-creator.md`) if missing (idempotent).
/// 3. Rebuild and return cache.
pub fn setup_skills(workspace_root: &str, app: &AppHandle) -> Result<Vec<Skill>, String> {
    let skills_dir = get_skills_dir(workspace_root);
    println!("[skills] Initializing skills directory at: {:?}", skills_dir);

    fs::create_dir_all(&skills_dir)
        .map_err(|e| format!("Failed to create skills directory {:?}: {}", skills_dir, e))?;

    // Write built-in templates idempotently
    for (filename, template_content) in BUILTIN_SKILLS {
        let skill_file = skills_dir.join(filename);
        if !skill_file.exists() {
            fs::write(&skill_file, template_content)
                .map_err(|e| format!("Failed to write built-in {}: {}", filename, e))?;
            println!("[skills] Wrote template {} to {:?}", filename, skill_file);
        }
    }

    reload_skills(workspace_root, app)
}

/// Perform `/skill-reload`:
/// Scan `.depdok/skills/*.md`, parse, rebuild store cache, return skill list.
pub fn reload_skills(workspace_root: &str, app: &AppHandle) -> Result<Vec<Skill>, String> {
    let skills_dir = get_skills_dir(workspace_root);
    if !skills_dir.exists() {
        save_skills_to_cache(workspace_root, &[], app);
        return Ok(Vec::new());
    }

    let entries = fs::read_dir(&skills_dir)
        .map_err(|e| format!("Failed to read skills directory {:?}: {}", skills_dir, e))?;

    let mut skills = Vec::new();

    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_file() && path.extension().and_then(|ext| ext.to_str()) == Some("md") {
            let file_path_str = path.to_string_lossy().to_string();
            match fs::read_to_string(&path) {
                Ok(content) => match parse_skill_markdown(&content, Some(file_path_str)) {
                    Ok(skill) => {
                        skills.push(skill);
                    }
                    Err(e) => {
                        eprintln!("[skills] Skipping invalid skill file {:?}: {}", path.file_name(), e);
                    }
                },
                Err(e) => {
                    eprintln!("[skills] Failed to read skill file {:?}: {}", path.file_name(), e);
                }
            }
        }
    }

    // Sort skills alphabetically by name
    skills.sort_by(|a, b| a.name.cmp(&b.name));

    save_skills_to_cache(workspace_root, &skills, app);
    println!("[skills] Reloaded {} skills from {:?}", skills.len(), skills_dir);

    Ok(skills)
}

/// Write a skill file to `<workspace>/.depdok/skills/<name>.md`, then rebuild cache.
pub fn write_skill_file(
    workspace_root: &str,
    name: &str,
    content: &str,
    app: &AppHandle,
) -> Result<Skill, String> {
    let skills_dir = get_skills_dir(workspace_root);
    fs::create_dir_all(&skills_dir)
        .map_err(|e| format!("Failed to create skills directory {:?}: {}", skills_dir, e))?;

    // Parse & validate content before writing
    let parsed_skill = parse_skill_markdown(content, None)?;
    let skill_name = if !name.trim().is_empty() { name.trim() } else { &parsed_skill.name };

    if !is_valid_skill_name(skill_name) {
        return Err(format!("Invalid skill name '{}': must match ^[a-z0-9-]+$", skill_name));
    }

    let file_path = skills_dir.join(format!("{}.md", skill_name));
    fs::write(&file_path, content).map_err(|e| format!("Failed to write skill file {:?}: {}", file_path, e))?;

    let file_path_str = file_path.to_string_lossy().to_string();

    // Trigger cache rebuild
    let _ = reload_skills(workspace_root, app);

    Ok(Skill {
        file_path: Some(file_path_str),
        ..parsed_skill
    })
}

/// Retrieve skills from store cache or re-read disk if not cached
pub fn get_cached_skills(workspace_root: &str, app: &AppHandle) -> Result<Vec<Skill>, String> {
    if let Some(cached) = load_skills_from_cache(workspace_root, app) {
        return Ok(cached);
    }
    reload_skills(workspace_root, app)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_builtin_skills_parse_successfully() {
        for (filename, template) in BUILTIN_SKILLS {
            let parsed = parse_skill_markdown(template, Some(filename.to_string()));
            assert!(
                parsed.is_ok(),
                "Built-in skill {} failed to parse: {:?}",
                filename,
                parsed.err()
            );
            let skill = parsed.unwrap();
            assert!(!skill.name.is_empty(), "Skill name cannot be empty: {}", filename);
            assert!(
                is_valid_skill_name(&skill.name),
                "Skill name '{}' in {} is invalid",
                skill.name,
                filename
            );
            assert!(!skill.description.is_empty(), "Skill description cannot be empty: {}", filename);
            assert!(!skill.body.is_empty(), "Skill body cannot be empty: {}", filename);
        }
    }
}
