use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tokio::sync::oneshot;

pub type ToolResultResponse = Result<serde_json::Value, String>;

#[derive(Clone, Default)]
pub struct PendingRequests {
    map: Arc<Mutex<HashMap<String, oneshot::Sender<ToolResultResponse>>>>,
}

impl PendingRequests {
    pub fn new() -> Self {
        Self {
            map: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub fn insert(&self, request_id: String, sender: oneshot::Sender<ToolResultResponse>) {
        let mut map = self.map.lock().unwrap();
        map.insert(request_id, sender);
    }

    pub fn resolve(&self, request_id: &str, result: ToolResultResponse) -> bool {
        let mut map = self.map.lock().unwrap();
        if let Some(sender) = map.remove(request_id) {
            let _ = sender.send(result);
            true
        } else {
            false
        }
    }

    pub fn remove(&self, request_id: &str) {
        let mut map = self.map.lock().unwrap();
        map.remove(request_id);
    }
}
