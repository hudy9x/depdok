use async_trait::async_trait;
use futures_util::StreamExt;
use reqwest::header::{HeaderMap, HeaderName, HeaderValue};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::{oneshot, Mutex, RwLock};

use super::McpTransport;

pub struct HttpTransport {
    server_name: String,
    #[allow(dead_code)]
    url: String,
    post_url: Arc<RwLock<String>>,
    client: reqwest::Client,
    headers: HeaderMap,
    session_id: Arc<RwLock<Option<String>>>,
    pending_requests: Arc<Mutex<HashMap<u64, oneshot::Sender<Result<Value, String>>>>>,
    next_id: AtomicU64,
}

impl HttpTransport {
    pub async fn connect(
        server_name: &str,
        url: &str,
        custom_headers: &HashMap<String, String>,
    ) -> Result<Self, String> {
        let mut headers = HeaderMap::new();
        for (k, v) in custom_headers {
            if let (Ok(hn), Ok(hv)) = (
                HeaderName::from_bytes(k.as_bytes()),
                HeaderValue::from_str(v),
            ) {
                headers.insert(hn, hv);
            }
        }

        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(45))
            .build()
            .map_err(|e| format!("Failed to create HTTP client for MCP server '{}': {}", server_name, e))?;

        let post_url = Arc::new(RwLock::new(url.to_string()));
        let session_id = Arc::new(RwLock::new(None));
        let pending_requests: Arc<Mutex<HashMap<u64, oneshot::Sender<Result<Value, String>>>>> =
            Arc::new(Mutex::new(HashMap::new()));

        let srv_name = server_name.to_string();
        let target_url = url.to_string();

        // 1. Check if the server is an SSE server by attempting a GET with Accept: text/event-stream
        let mut get_req = client
            .get(&target_url)
            .header(reqwest::header::ACCEPT, "text/event-stream, application/json");
        for (k, v) in &headers {
            get_req = get_req.header(k, v);
        }

        if let Ok(res) = get_req.send().await {
            let is_sse = res
                .headers()
                .get(reqwest::header::CONTENT_TYPE)
                .and_then(|v| v.to_str().ok())
                .map(|ct| ct.contains("text/event-stream"))
                .unwrap_or(false);

            if res.status().is_success() && is_sse {
                println!("[mcp_client][{}] Connected to SSE stream at {}", srv_name, target_url);

                let (init_tx, init_rx) = oneshot::channel::<Result<String, String>>();
                let post_url_clone = Arc::clone(&post_url);
                let session_id_clone = Arc::clone(&session_id);
                let pending_clone = Arc::clone(&pending_requests);
                let srv_name_stream = srv_name.clone();
                let base_url = target_url.clone();

                // Spawn SSE background listener
                tokio::spawn(async move {
                    let mut stream = res.bytes_stream();
                    let mut buffer = String::new();
                    let mut init_tx_opt = Some(init_tx);

                    while let Some(chunk_res) = stream.next().await {
                        match chunk_res {
                            Ok(chunk) => {
                                let chunk_str = String::from_utf8_lossy(&chunk);
                                buffer.push_str(&chunk_str);

                                while let Some(double_newline) = buffer.find("\n\n") {
                                    let event_block = buffer[..double_newline].to_string();
                                    buffer = buffer[double_newline + 2..].to_string();

                                    let mut current_event = "message".to_string();
                                    let mut current_data = String::new();

                                    for line in event_block.lines() {
                                        let trimmed = line.trim();
                                        if trimmed.starts_with("event:") {
                                            current_event = trimmed.trim_start_matches("event:").trim().to_string();
                                        } else if trimmed.starts_with("data:") {
                                            let data_line = trimmed.trim_start_matches("data:").trim();
                                            if !current_data.is_empty() {
                                                current_data.push('\n');
                                            }
                                            current_data.push_str(data_line);
                                        }
                                    }

                                    if current_event == "endpoint" {
                                        let endpoint_str = current_data.trim();
                                        println!("[mcp_client][{}] Received SSE endpoint: {}", srv_name_stream, endpoint_str);

                                        let resolved_url = if endpoint_str.starts_with("http://")
                                            || endpoint_str.starts_with("https://")
                                        {
                                            endpoint_str.to_string()
                                        } else {
                                            // Resolve relative path against base_url
                                            if let Ok(base) = reqwest::Url::parse(&base_url) {
                                                if let Ok(joined) = base.join(endpoint_str) {
                                                    joined.to_string()
                                                } else {
                                                    format!("{}{}", base_url.trim_end_matches('/'), endpoint_str)
                                                }
                                            } else {
                                                format!("{}{}", base_url.trim_end_matches('/'), endpoint_str)
                                            }
                                        };

                                        // Extract sessionId query parameter if present
                                        if let Ok(parsed) = reqwest::Url::parse(&resolved_url) {
                                            for (k, v) in parsed.query_pairs() {
                                                if k == "sessionId" {
                                                    let mut sid_guard = session_id_clone.write().await;
                                                    *sid_guard = Some(v.to_string());
                                                }
                                            }
                                        }

                                        {
                                            let mut pu_guard = post_url_clone.write().await;
                                            *pu_guard = resolved_url.clone();
                                        }

                                        if let Some(tx) = init_tx_opt.take() {
                                            let _ = tx.send(Ok(resolved_url));
                                        }
                                    } else if current_event == "message" && !current_data.is_empty() {
                                        if let Ok(val) = serde_json::from_str::<Value>(&current_data) {
                                            if let Some(id_u64) = val.get("id").and_then(|i| i.as_u64()) {
                                                let mut map = pending_clone.lock().await;
                                                if let Some(tx) = map.remove(&id_u64) {
                                                    if let Some(err) = val.get("error") {
                                                        let err_msg = err
                                                            .get("message")
                                                            .and_then(|m| m.as_str())
                                                            .unwrap_or("MCP error");
                                                        let _ = tx.send(Err(format!("MCP Server Error: {}", err_msg)));
                                                    } else if let Some(res) = val.get("result") {
                                                        let _ = tx.send(Ok(res.clone()));
                                                    } else {
                                                        let _ = tx.send(Ok(val));
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                            Err(e) => {
                                eprintln!("[mcp_client][{}] SSE stream error: {}", srv_name_stream, e);
                                break;
                            }
                        }
                    }

                    if let Some(tx) = init_tx_opt.take() {
                        let _ = tx.send(Err("SSE connection closed without endpoint event".to_string()));
                    }
                });

                // Wait up to 5 seconds to receive the endpoint event
                match tokio::time::timeout(Duration::from_secs(5), init_rx).await {
                    Ok(Ok(Ok(_resolved))) => {
                        println!("[mcp_client][{}] Ready via SSE post endpoint.", srv_name);
                    }
                    _ => {
                        println!("[mcp_client][{}] SSE handshake timeout or direct HTTP fallback.", srv_name);
                    }
                }
            }
        }

        Ok(Self {
            server_name: srv_name,
            url: target_url,
            post_url,
            client,
            headers,
            session_id,
            pending_requests,
            next_id: AtomicU64::new(1),
        })
    }
}

#[async_trait]
impl McpTransport for HttpTransport {
    async fn send_request(&self, method: &str, params: Option<Value>) -> Result<Value, String> {
        let req_id = self.next_id.fetch_add(1, Ordering::SeqCst);
        let request_val = json!({
            "jsonrpc": "2.0",
            "id": req_id,
            "method": method,
            "params": params.unwrap_or_else(|| json!({}))
        });

        let json_body = serde_json::to_string(&request_val)
            .map_err(|e| format!("Failed to serialize JSON-RPC request: {}", e))?;

        let target_post_url = { self.post_url.read().await.clone() };

        let (tx, rx) = oneshot::channel();
        {
            let mut map = self.pending_requests.lock().await;
            map.insert(req_id, tx);
        }

        let mut req_builder = self
            .client
            .post(&target_post_url)
            .header(reqwest::header::ACCEPT, "application/json, text/event-stream")
            .header(reqwest::header::CONTENT_TYPE, "application/json");

        if let Some(sid) = &*self.session_id.read().await {
            req_builder = req_builder.header("mcp-session-id", sid);
        }

        for (k, v) in &self.headers {
            req_builder = req_builder.header(k, v);
        }

        let res = req_builder
            .body(json_body)
            .send()
            .await
            .map_err(|e| format!("MCP HTTP Server '{}' request failed: {}", self.server_name, e))?;

        // Extract session ID from response headers if present
        if let Some(sid_val) = res.headers().get("mcp-session-id").and_then(|v| v.to_str().ok()) {
            let mut sid_guard = self.session_id.write().await;
            *sid_guard = Some(sid_val.to_string());
        }

        if !res.status().is_success() {
            let status = res.status();
            let body = res.text().await.unwrap_or_default();
            let mut map = self.pending_requests.lock().await;
            map.remove(&req_id);
            return Err(format!(
                "MCP HTTP Server '{}' returned HTTP {}: {}",
                self.server_name, status, body
            ));
        }

        // If response is HTTP 202 Accepted (SSE server will push result over SSE stream), wait for SSE receiver
        if res.status() == reqwest::StatusCode::ACCEPTED {
            match tokio::time::timeout(Duration::from_secs(30), rx).await {
                Ok(Ok(result)) => return result,
                Ok(Err(_)) => {
                    let mut map = self.pending_requests.lock().await;
                    map.remove(&req_id);
                    return Err(format!("MCP Server '{}' connection dropped unexpectedly", self.server_name));
                }
                Err(_) => {
                    let mut map = self.pending_requests.lock().await;
                    map.remove(&req_id);
                    return Err(format!("MCP Server '{}' request timed out (30s) on method '{}'", self.server_name, method));
                }
            }
        }

        let text = res
            .text()
            .await
            .map_err(|e| format!("Failed to read MCP HTTP Server '{}' response body: {}", self.server_name, e))?;

        {
            let mut map = self.pending_requests.lock().await;
            map.remove(&req_id);
        }

        if text.trim().is_empty() {
            // Some SSE servers return 200 OK with empty body and push result over SSE stream
            match tokio::time::timeout(Duration::from_secs(30), rx).await {
                Ok(Ok(result)) => return result,
                _ => return Ok(Value::Null),
            }
        }

        // Support both direct JSON and SSE (data: {...}) responses
        let body: Value = if let Ok(val) = serde_json::from_str::<Value>(&text) {
            val
        } else {
            let mut extracted = None;
            for line in text.lines() {
                let trimmed = line.trim();
                if trimmed.starts_with("data:") {
                    let json_part = trimmed.trim_start_matches("data:").trim();
                    if let Ok(val) = serde_json::from_str::<Value>(json_part) {
                        extracted = Some(val);
                        break;
                    }
                }
            }
            extracted.ok_or_else(|| {
                format!(
                    "Failed to parse MCP HTTP Server '{}' response as JSON or SSE (body: {})",
                    self.server_name, text
                )
            })?
        };

        if let Some(err) = body.get("error") {
            let err_msg = err.get("message").and_then(|m| m.as_str()).unwrap_or("MCP error");
            return Err(format!("MCP Server Error: {}", err_msg));
        }

        if let Some(res_val) = body.get("result") {
            Ok(res_val.clone())
        } else {
            Ok(body)
        }
    }

    async fn send_notification(&self, method: &str, params: Option<Value>) -> Result<(), String> {
        let notification_val = json!({
            "jsonrpc": "2.0",
            "method": method,
            "params": params.unwrap_or_else(|| json!({}))
        });

        let json_body = serde_json::to_string(&notification_val).unwrap_or_default();
        let target_post_url = { self.post_url.read().await.clone() };

        let mut req_builder = self
            .client
            .post(&target_post_url)
            .header(reqwest::header::ACCEPT, "application/json, text/event-stream")
            .header(reqwest::header::CONTENT_TYPE, "application/json");

        if let Some(sid) = &*self.session_id.read().await {
            req_builder = req_builder.header("mcp-session-id", sid);
        }

        for (k, v) in &self.headers {
            req_builder = req_builder.header(k, v);
        }

        let _ = req_builder.body(json_body).send().await;
        Ok(())
    }

    async fn close(&self) -> Result<(), String> {
        Ok(())
    }
}
