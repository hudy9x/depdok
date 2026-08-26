use async_trait::async_trait;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::path::PathBuf;
use std::process::Stdio;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, ChildStdin, Command};
use tokio::sync::{oneshot, Mutex};

use super::McpTransport;

#[allow(dead_code)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

pub struct StdioTransport {
    server_name: String,
    stdin: Arc<Mutex<Option<ChildStdin>>>,
    pending_requests: Arc<Mutex<HashMap<u64, oneshot::Sender<Result<Value, String>>>>>,
    next_id: AtomicU64,
    #[allow(dead_code)]
    child_pid: Option<u32>,
    _child: Arc<Mutex<Option<Child>>>,
}

impl StdioTransport {
    pub async fn spawn(
        server_name: &str,
        command: &str,
        args: &[String],
        env: &HashMap<String, String>,
        cwd: Option<&PathBuf>,
    ) -> Result<Self, String> {
        let mut cmd = Command::new(command);
        cmd.args(args)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        if let Some(dir) = cwd {
            cmd.current_dir(dir);
        }

        for (k, v) in env {
            cmd.env(k, v);
        }

        #[cfg(target_os = "windows")]
        {
            cmd.creation_flags(CREATE_NO_WINDOW);
        }

        let mut child = cmd
            .spawn()
            .map_err(|e| format!("Failed to spawn MCP stdio server '{}' (cmd: '{}'): {}", server_name, command, e))?;

        let pid = child.id();
        let stdin = child.stdin.take().ok_or_else(|| "Failed to capture MCP stdin".to_string())?;
        let stdout = child.stdout.take().ok_or_else(|| "Failed to capture MCP stdout".to_string())?;
        let stderr = child.stderr.take().ok_or_else(|| "Failed to capture MCP stderr".to_string())?;

        let pending_requests: Arc<Mutex<HashMap<u64, oneshot::Sender<Result<Value, String>>>>> =
            Arc::new(Mutex::new(HashMap::new()));

        let srv_name_out = server_name.to_string();
        let pending_out = Arc::clone(&pending_requests);

        // Spawn stdout reader task
        tokio::spawn(async move {
            let mut reader = BufReader::new(stdout).lines();
            while let Ok(Some(line)) = reader.next_line().await {
                let trimmed = line.trim();
                if trimmed.is_empty() {
                    continue;
                }

                if let Ok(val) = serde_json::from_str::<Value>(trimmed) {
                    if let Some(id_u64) = val.get("id").and_then(|i| i.as_u64()) {
                        let mut map = pending_out.lock().await;
                        if let Some(tx) = map.remove(&id_u64) {
                            if let Some(err) = val.get("error") {
                                let err_msg = err.get("message").and_then(|m| m.as_str()).unwrap_or("MCP error");
                                let _ = tx.send(Err(format!("MCP Server Error: {}", err_msg)));
                            } else if let Some(res) = val.get("result") {
                                let _ = tx.send(Ok(res.clone()));
                            } else {
                                let _ = tx.send(Ok(val));
                            }
                        }
                    } else if let Some(method) = val.get("method").and_then(|m| m.as_str()) {
                        // Server notification
                        println!("[mcp_client][{}][notification] method: {}", srv_name_out, method);
                    }
                }
            }
        });

        // Spawn stderr logger task
        let srv_name_err = server_name.to_string();
        tokio::spawn(async move {
            let mut reader = BufReader::new(stderr).lines();
            while let Ok(Some(line)) = reader.next_line().await {
                let trimmed = line.trim();
                if !trimmed.is_empty() {
                    println!("[mcp_client][{}][stderr] {}", srv_name_err, trimmed);
                }
            }
        });

        Ok(Self {
            server_name: server_name.to_string(),
            stdin: Arc::new(Mutex::new(Some(stdin))),
            pending_requests,
            next_id: AtomicU64::new(1),
            child_pid: pid,
            _child: Arc::new(Mutex::new(Some(child))),
        })
    }
}

#[async_trait]
impl McpTransport for StdioTransport {
    async fn send_request(&self, method: &str, params: Option<Value>) -> Result<Value, String> {
        let req_id = self.next_id.fetch_add(1, Ordering::SeqCst);
        let request_val = json!({
            "jsonrpc": "2.0",
            "id": req_id,
            "method": method,
            "params": params.unwrap_or_else(|| json!({}))
        });

        let (tx, rx) = oneshot::channel();
        {
            let mut map = self.pending_requests.lock().await;
            map.insert(req_id, tx);
        }

        let line = format!("{}\n", serde_json::to_string(&request_val).unwrap());

        {
            let mut stdin_guard = self.stdin.lock().await;
            if let Some(stdin) = stdin_guard.as_mut() {
                stdin
                    .write_all(line.as_bytes())
                    .await
                    .map_err(|e| format!("Failed to write to MCP server '{}' stdin: {}", self.server_name, e))?;
                stdin
                    .flush()
                    .await
                    .map_err(|e| format!("Failed to flush MCP server '{}' stdin: {}", self.server_name, e))?;
            } else {
                return Err(format!("MCP Server '{}' stdin is closed", self.server_name));
            }
        }

        // Wait with a 30-second timeout
        match tokio::time::timeout(Duration::from_secs(30), rx).await {
            Ok(Ok(result)) => result,
            Ok(Err(_)) => {
                let mut map = self.pending_requests.lock().await;
                map.remove(&req_id);
                Err(format!("MCP Server '{}' connection dropped unexpectedly", self.server_name))
            }
            Err(_) => {
                let mut map = self.pending_requests.lock().await;
                map.remove(&req_id);
                Err(format!("MCP Server '{}' request timed out (30s) on method '{}'", self.server_name, method))
            }
        }
    }

    async fn send_notification(&self, method: &str, params: Option<Value>) -> Result<(), String> {
        let notification_val = json!({
            "jsonrpc": "2.0",
            "method": method,
            "params": params.unwrap_or_else(|| json!({}))
        });

        let line = format!("{}\n", serde_json::to_string(&notification_val).unwrap());

        let mut stdin_guard = self.stdin.lock().await;
        if let Some(stdin) = stdin_guard.as_mut() {
            stdin
                .write_all(line.as_bytes())
                .await
                .map_err(|e| format!("Failed to write notification to MCP server '{}': {}", self.server_name, e))?;
            stdin
                .flush()
                .await
                .map_err(|e| format!("Failed to flush notification to MCP server '{}': {}", self.server_name, e))?;
            Ok(())
        } else {
            Err(format!("MCP Server '{}' stdin is closed", self.server_name))
        }
    }

    async fn close(&self) -> Result<(), String> {
        // Drop stdin to signal EOF to the child process
        {
            let mut stdin_guard = self.stdin.lock().await;
            let _ = stdin_guard.take();
        }

        // Clean up process if still running
        #[cfg(target_os = "windows")]
        if let Some(pid) = self.child_pid {
            let _ = tokio::process::Command::new("taskkill")
                .args(["/F", "/T", "/PID", &pid.to_string()])
                .creation_flags(CREATE_NO_WINDOW)
                .output()
                .await;
        }

        #[cfg(not(target_os = "windows"))]
        {
            let mut child_guard = self._child.lock().await;
            if let Some(mut child) = child_guard.take() {
                let _ = child.kill().await;
            }
        }

        Ok(())
    }
}
