use rmcp::{handler::server::router::tool::ToolRouter, model::*, ServerHandler};
use std::sync::Arc;

use crate::knowledge_base::manager::KbManager;
use crate::mcp_server::McpServerConfig;

#[derive(Clone)]
pub struct KbMcpService {
    pub(crate) config: McpServerConfig,
    pub(crate) kb_manager: Arc<KbManager>,
    tool_router: ToolRouter<KbMcpService>,
}

impl KbMcpService {
    pub fn new(config: McpServerConfig, kb_manager: KbManager) -> Self {
        Self {
            config,
            kb_manager: Arc::new(kb_manager),
            tool_router: Self::kb_tool_router(),
        }
    }
}

#[rmcp::tool_handler]
impl ServerHandler for KbMcpService {
    fn get_info(&self) -> ServerInfo {
        ServerInfo {
            protocol_version: ProtocolVersion::V_2024_11_05,
            capabilities: ServerCapabilities::builder().enable_tools().build(),
            server_info: Implementation {
                name: self.config.server_name.clone(),
                version: self.config.server_version.clone(),
                ..Default::default()
            },
            instructions: None,
        }
    }
}
