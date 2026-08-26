pub mod http;
pub mod stdio;

use async_trait::async_trait;
use serde_json::Value;

#[async_trait]
pub trait McpTransport: Send + Sync {
    /// Send a JSON-RPC 2.0 request and wait for the response.
    async fn send_request(&self, method: &str, params: Option<Value>) -> Result<Value, String>;

    /// Send a JSON-RPC 2.0 notification (no response expected).
    async fn send_notification(&self, method: &str, params: Option<Value>) -> Result<(), String>;

    /// Gracefully close the transport and terminate any underlying resources.
    async fn close(&self) -> Result<(), String>;
}
