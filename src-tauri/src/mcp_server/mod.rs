mod config;
mod service;
mod tools;

use std::path::Path;

use crate::knowledge_base::db::init_database_at_path;
use crate::knowledge_base::embedding;
use crate::knowledge_base::manager::KbManager;

pub use config::McpServerConfig;
pub use service::KbMcpService;

pub fn run() -> Result<(), String> {
    let rt = tokio::runtime::Runtime::new().map_err(|e| e.to_string())?;
    rt.block_on(async {
        let config = McpServerConfig::load()?;
        let kb_manager = build_state(&config)?;
        let service = KbMcpService::new(config, kb_manager);
        
        use rmcp::{transport::stdio, ServiceExt};
        let running = service.serve(stdio()).await.map_err(|e| e.to_string())?;
        running.waiting().await.map_err(|e| e.to_string())?;
        Ok(())
    })
}

fn build_state(config: &McpServerConfig) -> Result<KbManager, String> {
    if let Some(parent) = config.database_path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create MCP database directory: {e}"))?;
    }

    std::fs::create_dir_all(&config.cache_dir)
        .map_err(|e| format!("Failed to create MCP cache directory: {e}"))?;

    let embedder = embedding::init_embedder(Some(config.cache_dir.clone()))?;
    let dims = embedder.dimensions();
    let conn = init_database_at_path(Path::new(&config.database_path), dims)?;
    let kb_manager = KbManager::new(conn, embedder);

    Ok(kb_manager)
}