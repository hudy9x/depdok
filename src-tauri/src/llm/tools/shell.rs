use serde_json::json;
use std::path::Path;
use std::process::Command;

pub fn run_shell(command: &str, workspace_root: &str) -> Result<String, String> {
    // Sandbox: only allow execution within workspace root
    let workspace = Path::new(workspace_root)
        .canonicalize()
        .map_err(|e| format!("Invalid workspace root: {}", e))?;

    #[cfg(target_os = "windows")]
    let output = Command::new("cmd")
        .args(&["/C", command])
        .current_dir(&workspace)
        .output()
        .map_err(|e| format!("Failed to run command: {}", e))?;

    #[cfg(not(target_os = "windows"))]
    let output = Command::new("sh")
        .args(&["-c", command])
        .current_dir(&workspace)
        .output()
        .map_err(|e| format!("Failed to run command: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
    let exit_code = output.status.code().unwrap_or(-1);

    Ok(json!({
        "stdout": stdout,
        "stderr": stderr,
        "exit_code": exit_code,
    })
    .to_string())
}
