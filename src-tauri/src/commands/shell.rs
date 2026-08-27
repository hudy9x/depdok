use serde::{Deserialize, Serialize};
use std::path::Path;
use std::time::{Duration, Instant};

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct ShellExecutionResult {
    pub command: String,
    pub cwd: String,
    pub stdout: String,
    pub stderr: String,
    pub exit_code: i32,
    pub success: bool,
    pub truncated: bool,
    pub duration_ms: u64,
}

const MAX_OUTPUT_CHARS: usize = 4000;
const DEFAULT_TIMEOUT_MS: u64 = 30_000;
const MAX_TIMEOUT_MS: u64 = 120_000;

fn truncate_output(output: &str, limit: usize) -> (String, bool) {
    if output.chars().count() <= limit {
        (output.to_string(), false)
    } else {
        let truncated: String = output.chars().take(limit).collect();
        (
            format!("{}\n...(truncated: exceeded {} characters)", truncated, limit),
            true,
        )
    }
}

#[tauri::command]
pub async fn execute_shell_command(
    command: String,
    cwd: Option<String>,
    timeout_ms: Option<u64>,
) -> Result<ShellExecutionResult, String> {
    let start_time = Instant::now();
    let timeout_duration = Duration::from_millis(
        timeout_ms
            .unwrap_or(DEFAULT_TIMEOUT_MS)
            .clamp(1_000, MAX_TIMEOUT_MS),
    );

    // Resolve working directory
    let resolved_cwd = if let Some(ref dir) = cwd {
        let path = Path::new(dir);
        if path.exists() {
            path.canonicalize()
                .unwrap_or_else(|_| path.to_path_buf())
                .to_string_lossy()
                .to_string()
        } else {
            std::env::current_dir()
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_else(|_| ".".to_string())
        }
    } else {
        std::env::current_dir()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|_| ".".to_string())
    };

    // Configure platform-specific shell invocation
    #[cfg(target_os = "windows")]
    let mut cmd = {
        let mut c = tokio::process::Command::new("cmd");
        c.args(["/C", &command]);
        c
    };

    #[cfg(not(target_os = "windows"))]
    let mut cmd = {
        let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/sh".to_string());
        let mut c = tokio::process::Command::new(shell);
        c.args(["-c", &command]);
        c
    };

    cmd.current_dir(&resolved_cwd);
    cmd.kill_on_drop(true);

    // Execute with timeout
    let exec_future = cmd.output();
    let output_result = tokio::time::timeout(timeout_duration, exec_future).await;

    let duration_ms = start_time.elapsed().as_millis() as u64;

    match output_result {
        Ok(Ok(output)) => {
            let raw_stdout = String::from_utf8_lossy(&output.stdout);
            let raw_stderr = String::from_utf8_lossy(&output.stderr);

            let (stdout, stdout_truncated) = truncate_output(&raw_stdout, MAX_OUTPUT_CHARS);
            let (stderr, stderr_truncated) = truncate_output(&raw_stderr, MAX_OUTPUT_CHARS);
            let exit_code = output.status.code().unwrap_or(-1);

            Ok(ShellExecutionResult {
                command,
                cwd: resolved_cwd,
                stdout,
                stderr,
                exit_code,
                success: output.status.success(),
                truncated: stdout_truncated || stderr_truncated,
                duration_ms,
            })
        }
        Ok(Err(e)) => Err(format!("Failed to execute command '{}': {}", command, e)),
        Err(_) => Err(format!(
            "Command '{}' timed out after {}ms",
            command,
            timeout_duration.as_millis()
        )),
    }
}
