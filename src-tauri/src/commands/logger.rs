use axum::{
    extract::{Path, State},
    http::StatusCode,
    routing::post,
    Json, Router,
};
use std::collections::HashMap;
use std::fs::OpenOptions;
use std::io::Write;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager};
use tokio::sync::Mutex as AsyncMutex;
use tower_http::cors::{Any, CorsLayer};

#[derive(Clone)]
pub struct LoggerServerState {
    pub active_channels: Arc<AsyncMutex<HashMap<String, String>>>, // channel_name -> file_path
    pub is_running: Arc<AsyncMutex<bool>>,
}

impl LoggerServerState {
    pub fn new() -> Self {
         Self {
             active_channels: Arc::new(AsyncMutex::new(HashMap::new())),
             is_running: Arc::new(AsyncMutex::new(false)),
         }
    }
}

async fn handle_log_post(
    State(app_handle): State<AppHandle>,
    Path(channel): Path<String>,
    Json(payload): Json<serde_json::Value>,
) -> Result<StatusCode, (StatusCode, String)> {
    let state = app_handle.state::<LoggerServerState>();
    
    // 1. Emit event to frontend
    let emit_payload = serde_json::json!({
        "channel": channel,
        "data": payload
    });
    
    let _ = app_handle.emit("logger-event", emit_payload);

    // 2. Append to file if registered
    let channels = state.active_channels.lock().await;
    if let Some(file_path) = channels.get(&channel) {
        if let Ok(mut file) = OpenOptions::new()
            .create(true)
            .append(true)
            .open(file_path)
        {
            if let Ok(log_line) = serde_json::to_string(&payload) {
                let _ = writeln!(file, "{}", log_line);
            }
        }
    }

    Ok(StatusCode::OK)
}

#[tauri::command]
pub async fn register_logger_channel(
    channel: String,
    file_path: String,
    state: tauri::State<'_, LoggerServerState>,
) -> Result<(), String> {
    let mut channels = state.active_channels.lock().await;
    channels.insert(channel, file_path);
    Ok(())
}

#[tauri::command]
pub async fn start_logger_server(
    app: tauri::AppHandle,
    state: tauri::State<'_, LoggerServerState>,
) -> Result<String, String> {
    let mut is_running = state.is_running.lock().await;
    
    let ip = "localhost".to_string();
    let port = 8080;
    let url = format!("http://{}:{}", ip, port);

    if *is_running {
        return Ok(url);
    }

    *is_running = true;

    let app_handle_clone = app.clone();
    
    tokio::spawn(async move {
        let cors = CorsLayer::new()
            .allow_origin(Any)
            .allow_methods(Any)
            .allow_headers(Any);
            
        // Use /{channel} for axum 0.8+
        let router = Router::new()
            .route("/{channel}", post(handle_log_post))
            .layer(cors)
            .with_state(app_handle_clone);
            
        let addr = format!("[::]:{}", port);
        if let Ok(listener) = tokio::net::TcpListener::bind(&addr).await {
            let _ = axum::serve(listener, router).await;
        }
    });

    Ok(url)
}
