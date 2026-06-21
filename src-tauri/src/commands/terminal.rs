use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::{Arc, Mutex};
use portable_pty::{CommandBuilder, native_pty_system, PtySize};
use tauri::{AppHandle, Emitter};

// ─── Session types ─────────────────────────────────────────────────────────────

/// Internal data kept per open PTY tab.
struct PtySession {
    /// PTY master — kept alive to keep the PTY open; also used for resize.
    master: Box<dyn portable_pty::MasterPty + Send>,
    /// Write end of the PTY — sends keyboard input to the shell.
    writer: Box<dyn Write + Send>,
    /// Reserved for future graceful kill signaling; kept so the channel stays alive.
    #[allow(dead_code)]
    kill_tx: std::sync::mpsc::SyncSender<()>,
}

// ─── State ─────────────────────────────────────────────────────────────────────

/// Tauri-managed state holding all open terminal sessions.
pub struct TerminalState {
    sessions: Mutex<HashMap<String, PtySession>>,
}

impl TerminalState {
    pub fn new() -> Self {
        Self {
            sessions: Mutex::new(HashMap::new()),
        }
    }

    /// Close every open PTY — called from the `RunEvent::Exit` handler to prevent
    /// orphaned shell processes after a force-quit or crash.
    pub fn kill_all(&self) {
        if let Ok(mut map) = self.sessions.lock() {
            // Dropping PtySession drops the master, which closes the PTY and kills the child.
            map.clear();
        }
    }
}

// ─── Commands ──────────────────────────────────────────────────────────────────

/// Spawn a new PTY session for `tab_id`.
///
/// Emits:
/// - `pty-data-{tab_id}`  (payload: `String`)  — shell output
/// - `pty-exit-{tab_id}`  (payload: `null`)     — child process exited
#[tauri::command]
pub fn start_pty_session(
    app: AppHandle,
    state: tauri::State<'_, Arc<TerminalState>>,
    tab_id: String,
    shell_path: String,
    cwd: String,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    // Close any pre-existing session with this tab_id (e.g. restart).
    {
        let mut map = state.sessions.lock().unwrap();
        map.remove(&tab_id);
    }

    let pty_system = native_pty_system();
    let size = PtySize { rows, cols, pixel_width: 0, pixel_height: 0 };

    let pair = pty_system
        .openpty(size)
        .map_err(|e| format!("Failed to open PTY: {}", e))?;

    let mut cmd = CommandBuilder::new(&shell_path);
    cmd.cwd(&cwd);
    cmd.env("TERM", "xterm-256color");

    let _child = pair
        .slave
        .spawn_command(cmd)
        .map_err(|e| format!("Failed to spawn shell '{}': {}", shell_path, e))?;

    let master = pair.master;

    let writer = master
        .take_writer()
        .map_err(|e| format!("Failed to take PTY writer: {}", e))?;

    // ── Reader thread: forward PTY output → frontend event ──
    let mut reader = master
        .try_clone_reader()
        .map_err(|e| format!("Failed to clone PTY reader: {}", e))?;

    let app_data = app.clone();
    let data_event = format!("pty-data-{}", tab_id);
    let exit_event_reader = format!("pty-exit-{}", tab_id);
    let app_exit_reader = app.clone();

    std::thread::spawn(move || {
        let mut buf = [0u8; 4096];
        loop {
            match reader.read(&mut buf) {
                Ok(0) | Err(_) => {
                    // EOF — child process exited or PTY was closed.
                    let _ = app_exit_reader.emit(&exit_event_reader, ());
                    break;
                }
                Ok(n) => {
                    let text = String::from_utf8_lossy(&buf[..n]).to_string();
                    let _ = app_data.emit(&data_event, text);
                }
            }
        }
    });

    // ── Kill channel so close_pty_session can signal the watcher ──
    let (kill_tx, _kill_rx) = std::sync::mpsc::sync_channel::<()>(1);

    // Store session.
    {
        let mut map = state.sessions.lock().unwrap();
        map.insert(tab_id, PtySession { master, writer, kill_tx });
    }

    Ok(())
}

/// Write keyboard input to the PTY.
#[tauri::command]
pub fn write_to_pty(
    state: tauri::State<'_, Arc<TerminalState>>,
    tab_id: String,
    data: String,
) -> Result<(), String> {
    let mut map = state.sessions.lock().unwrap();
    let session = map
        .get_mut(&tab_id)
        .ok_or_else(|| format!("No PTY session for tab '{}'", tab_id))?;
    session
        .writer
        .write_all(data.as_bytes())
        .map_err(|e| format!("Write to PTY failed: {}", e))
}

/// Resize the PTY window (called after the terminal panel is resized).
#[tauri::command]
pub fn resize_pty(
    state: tauri::State<'_, Arc<TerminalState>>,
    tab_id: String,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    let map = state.sessions.lock().unwrap();
    let session = map
        .get(&tab_id)
        .ok_or_else(|| format!("No PTY session for tab '{}'", tab_id))?;
    session
        .master
        .resize(PtySize { rows, cols, pixel_width: 0, pixel_height: 0 })
        .map_err(|e| format!("Resize PTY failed: {}", e))
}

/// Close a PTY session and terminate its shell process.
#[tauri::command]
pub fn close_pty_session(
    state: tauri::State<'_, Arc<TerminalState>>,
    tab_id: String,
) -> Result<(), String> {
    let mut map = state.sessions.lock().unwrap();
    // Removing the entry drops PtySession, which drops the master, closing the PTY
    // and causing the child shell to receive a HUP signal.
    map.remove(&tab_id);
    Ok(())
}
