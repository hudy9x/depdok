use tauri::command;
use std::process::Command;
use notify_debouncer_full::{new_debouncer, notify::RecursiveMode, DebounceEventResult};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

#[command]
pub fn get_current_branch(working_dir: String) -> Result<String, String> {
    let mut cmd = Command::new("git");
    cmd.current_dir(&working_dir)
        .args(["branch", "--show-current"]);
    
    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);
    
    let output = cmd.output()
        .map_err(|e| format!("Failed to execute git command: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    let mut branch = String::from_utf8_lossy(&output.stdout)
        .trim()
        .to_string();
    
    if !branch.is_empty() {
        let mut status_cmd = Command::new("git");
        status_cmd.current_dir(&working_dir)
            .args(["status", "--porcelain"]);
        
        #[cfg(target_os = "windows")]
        status_cmd.creation_flags(CREATE_NO_WINDOW);

        if let Ok(status_output) = status_cmd.output() {
            if status_output.status.success() && !status_output.stdout.is_empty() {
                branch.push('*');
            }
        }
    }
    
    Ok(branch)
}

#[command]
pub fn get_all_branches(working_dir: String) -> Result<Vec<String>, String> {
    let mut cmd = Command::new("git");
    cmd.current_dir(&working_dir)
        .args(["branch", "--list"]);
    
    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);
    
    let output = cmd.output()
        .map_err(|e| format!("Failed to execute git command: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    let branches: Vec<String> = String::from_utf8_lossy(&output.stdout)
        .lines()
        .map(|line| {
            // Remove the "* " prefix from current branch and trim whitespace
            line.trim_start_matches("* ").trim().to_string()
        })
        .filter(|line| !line.is_empty())
        .collect();
    
    Ok(branches)
}

#[command]
pub fn switch_branch(working_dir: String, branch: String) -> Result<String, String> {
    let mut cmd = Command::new("git");
    cmd.current_dir(&working_dir)
        .args(["checkout", &branch]);
    
    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);
    
    let output = cmd.output()
        .map_err(|e| format!("Failed to execute git command: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    Ok(format!("Switched to branch '{}'", branch))
}

#[command]
pub fn get_git_status(working_dir: String) -> Result<std::collections::HashMap<String, String>, String> {
    let mut cmd = Command::new("git");
    cmd.current_dir(&working_dir)
        .args(["status", "--short", "--porcelain"]);
    
    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);
    
    let output = cmd.output()
        .map_err(|e| format!("Failed to execute git command: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    let mut status_map = std::collections::HashMap::new();
    
    for line in String::from_utf8_lossy(&output.stdout).lines() {
        if line.len() < 4 {
            continue;
        }
        
        // Git status format: XY filename
        // X = index status, Y = working tree status
        let status_code = &line[0..2];
        let relative_path = line[3..].trim();
        
        // Convert relative path to absolute path
        let absolute_path = if working_dir.ends_with('/') {
            format!("{}{}", working_dir, relative_path)
        } else {
            format!("{}/{}", working_dir, relative_path)
        };
        
        // Determine the status based on the code
        let status = match status_code.trim() {
            "M" | " M" | "MM" => "modified",
            "A" | "AM" => "added",
            "D" | " D" => "deleted",
            "R" => "renamed",
            "C" => "copied",
            "??" => "untracked",
            _ => "unknown",
        };
        
        status_map.insert(absolute_path, status.to_string());
    }
    
    Ok(status_map)
}

#[command]
pub fn git_pull(working_dir: String) -> Result<String, String> {
    let mut cmd = Command::new("git");
    cmd.current_dir(&working_dir)
        .args(["pull"]);
    
    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);
    
    let output = cmd.output()
        .map_err(|e| format!("Failed to execute git command: {}", e))?;

    // Combine stdout and stderr for complete output
    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    let combined_output = format!("{}{}", stdout, stderr);

    if !output.status.success() {
        return Err(combined_output);
    }

    Ok(combined_output)
}

#[command]
pub fn get_git_sync_status(working_dir: String) -> Result<(usize, usize), String> {
    let mut cmd = Command::new("git");
    cmd.current_dir(&working_dir)
        .args(["rev-list", "--count", "--left-right", "HEAD...@{u}"]);
    
    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);
    
    let output = cmd.output()
        .map_err(|e| format!("Failed to execute git command: {}", e))?;

    if output.status.success() {
        let output_str = String::from_utf8_lossy(&output.stdout);
        let parts: Vec<&str> = output_str.trim().split_whitespace().collect();
        if parts.len() == 2 {
            let ahead = parts[0].parse::<usize>().unwrap_or(0);
            let behind = parts[1].parse::<usize>().unwrap_or(0);
            return Ok((ahead, behind));
        }
    }

    // Fallback 1: Try comparing with origin/main
    let mut fallback_cmd = Command::new("git");
    fallback_cmd.current_dir(&working_dir)
        .args(["rev-list", "--count", "--left-right", "HEAD...origin/main"]);
    
    #[cfg(target_os = "windows")]
    fallback_cmd.creation_flags(CREATE_NO_WINDOW);

    if let Ok(fallback_output) = fallback_cmd.output() {
        if fallback_output.status.success() {
            let output_str = String::from_utf8_lossy(&fallback_output.stdout);
            let parts: Vec<&str> = output_str.trim().split_whitespace().collect();
            if parts.len() == 2 {
                let ahead = parts[0].parse::<usize>().unwrap_or(0);
                let behind = parts[1].parse::<usize>().unwrap_or(0);
                return Ok((ahead, behind));
            }
        }
    }

    // Fallback 2: Try comparing with main
    let mut fallback_main_cmd = Command::new("git");
    fallback_main_cmd.current_dir(&working_dir)
        .args(["rev-list", "--count", "--left-right", "HEAD...main"]);
    
    #[cfg(target_os = "windows")]
    fallback_main_cmd.creation_flags(CREATE_NO_WINDOW);

    if let Ok(fallback_output) = fallback_main_cmd.output() {
        if fallback_output.status.success() {
            let output_str = String::from_utf8_lossy(&fallback_output.stdout);
            let parts: Vec<&str> = output_str.trim().split_whitespace().collect();
            if parts.len() == 2 {
                let ahead = parts[0].parse::<usize>().unwrap_or(0);
                let behind = parts[1].parse::<usize>().unwrap_or(0);
                return Ok((ahead, behind));
            }
        }
    }

    Ok((0, 0))
}

pub struct GitWatcher {
    pub current_workspace: Arc<Mutex<Option<String>>>,
}

impl GitWatcher {
    pub fn new() -> Self {
        Self {
            current_workspace: Arc::new(Mutex::new(None)),
        }
    }
}

#[command]
pub fn start_watching_git(workspace_root: String, app: AppHandle) -> Result<(), String> {
    let git_path = PathBuf::from(&workspace_root).join(".git");
    if !git_path.exists() {
        return Err(format!("Not a git repository: {}", workspace_root));
    }

    let state = app.state::<GitWatcher>();
    
    // Update the current watched workspace
    {
        let mut current = state.current_workspace.lock().map_err(|e| e.to_string())?;
        *current = Some(workspace_root.clone());
    }

    #[cfg(debug_assertions)]
    println!("Started watching Git directory for: {}", workspace_root);

    let watch_path = git_path.clone();
    let workspace_root_clone = workspace_root.clone();
    let app_handle = app.clone();
    let current_workspace_ref = state.current_workspace.clone();

    std::thread::spawn(move || {
        let result = (|| -> Result<(), String> {
            let app_clone = app_handle.clone();
            let workspace_clone = workspace_root_clone.clone();
            let workspace_for_closure = workspace_clone.clone();
            let current_workspace_clone = current_workspace_ref.clone();

            let mut debouncer = new_debouncer(
                Duration::from_millis(500),
                None,
                move |result: DebounceEventResult| {
                    match result {
                        Ok(events) => {
                            if !events.is_empty() {
                                #[cfg(debug_assertions)]
                                // println!("Git repository changed: {}", workspace_for_closure);
                                
                                // Emit git-changed event to frontend
                                let _ = app_clone.emit("git-changed", workspace_for_closure.clone());
                            }
                        }
                        Err(_errors) => {
                            #[cfg(debug_assertions)]
                            eprintln!("Git watch error: {:?}", _errors);
                        }
                    }
                },
            ).map_err(|e| e.to_string())?;

            // Watch the .git directory recursively
            debouncer
                .watch(watch_path.as_path(), RecursiveMode::Recursive)
                .map_err(|e| e.to_string())?;

            // Keep the debouncer alive
            loop {
                std::thread::sleep(Duration::from_secs(1));
                
                let current = current_workspace_clone.lock().ok()
                    .and_then(|guard| guard.clone());
                
                if current.as_ref() != Some(&workspace_clone) {
                    #[cfg(debug_assertions)]
                    println!("Stopping Git watcher for: {}", workspace_clone);
                    break;
                }
            }

            Ok(())
        })();

        if let Err(e) = result {
            eprintln!("Git watcher error: {}", e);
        }
    });

    Ok(())
}

#[command]
pub fn stop_watching_git(app: AppHandle) -> Result<(), String> {
    let state = app.state::<GitWatcher>();
    let mut current = state.current_workspace.lock().map_err(|e| e.to_string())?;
    if let Some(_path) = current.take() {
        #[cfg(debug_assertions)]
        println!("Stopped watching Git for: {}", _path);
    }
    Ok(())
}

#[command]
pub fn is_git_repository(working_dir: String) -> bool {
    let git_path = PathBuf::from(&working_dir).join(".git");
    git_path.exists()
}

#[derive(serde::Serialize, serde::Deserialize, Clone)]
pub struct GitRefInfo {
    pub name: String,
    pub ref_type: String, // "branch" or "tag"
    pub date: String,
    pub author: String,
    pub subject: String,
}

#[command]
pub fn get_git_refs(working_dir: String) -> Result<Vec<GitRefInfo>, String> {
    let mut refs = Vec::new();

    // 1. Fetch branches
    let mut cmd = Command::new("git");
    cmd.current_dir(&working_dir)
        .args([
            "for-each-ref",
            "--sort=-committerdate",
            "--format=%(refname:short)|%(committerdate:relative)|%(authorname)|%(subject)",
            "refs/heads/"
        ]);
    
    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);

    if let Ok(output) = cmd.output() {
        if output.status.success() {
            let stdout = String::from_utf8_lossy(&output.stdout);
            for line in stdout.lines() {
                let parts: Vec<&str> = line.split('|').collect();
                if parts.len() >= 4 {
                    refs.push(GitRefInfo {
                        name: parts[0].to_string(),
                        ref_type: "branch".to_string(),
                        date: parts[1].to_string(),
                        author: parts[2].to_string(),
                        subject: parts[3..].join("|"),
                    });
                }
            }
        }
    }

    // 2. Fetch tags
    let mut cmd = Command::new("git");
    cmd.current_dir(&working_dir)
        .args([
            "for-each-ref",
            "--sort=-committerdate",
            "--format=%(refname:short)|%(committerdate:relative)|%(authorname)|%(subject)",
            "refs/tags/"
        ]);
    
    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);

    if let Ok(output) = cmd.output() {
        if output.status.success() {
            let stdout = String::from_utf8_lossy(&output.stdout);
            for line in stdout.lines() {
                let parts: Vec<&str> = line.split('|').collect();
                if parts.len() >= 4 {
                    refs.push(GitRefInfo {
                        name: parts[0].to_string(),
                        ref_type: "tag".to_string(),
                        date: parts[1].to_string(),
                        author: parts[2].to_string(),
                        subject: parts[3..].join("|"),
                    });
                }
            }
        }
    }

    Ok(refs)
}

#[command]
pub fn create_branch(working_dir: String, branch_name: String, base_branch: Option<String>) -> Result<String, String> {
    let mut cmd = Command::new("git");
    cmd.current_dir(&working_dir);
    
    if let Some(base) = base_branch {
        cmd.args(["checkout", "-b", &branch_name, &base]);
    } else {
        cmd.args(["checkout", "-b", &branch_name]);
    }

    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);

    let output = cmd.output()
        .map_err(|e| format!("Failed to execute git command: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    Ok(format!("Created and switched to branch '{}'", branch_name))
}

#[command]
pub fn checkout_detached(working_dir: String, name: String) -> Result<String, String> {
    let mut cmd = Command::new("git");
    cmd.current_dir(&working_dir)
        .args(["checkout", "--detach", &name]);

    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);

    let output = cmd.output()
        .map_err(|e| format!("Failed to execute git command: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    Ok(format!("Checked out '{}' in detached HEAD state", name))
}




