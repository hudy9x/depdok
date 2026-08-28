use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use tokio::sync::oneshot;

pub type ToolResultResponse = Result<serde_json::Value, String>;

#[derive(Clone, Default)]
pub struct PendingRequests {
    map: Arc<Mutex<HashMap<String, oneshot::Sender<ToolResultResponse>>>>,
    cancels: Arc<Mutex<HashMap<String, Arc<AtomicBool>>>>,
    active_cancel: Arc<AtomicBool>,
}

impl PendingRequests {
    pub fn new() -> Self {
        Self {
            map: Arc::new(Mutex::new(HashMap::new())),
            cancels: Arc::new(Mutex::new(HashMap::new())),
            active_cancel: Arc::new(AtomicBool::new(false)),
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

    pub fn register_cancel(&self, message_id: &str) -> Arc<AtomicBool> {
        let flag = Arc::new(AtomicBool::new(false));
        let mut cancels = self.cancels.lock().unwrap();
        cancels.insert(message_id.to_string(), flag.clone());
        self.active_cancel.store(false, Ordering::Relaxed);
        flag
    }

    pub fn cancel(&self, message_id: Option<&str>) {
        self.active_cancel.store(true, Ordering::Relaxed);
        let cancels = self.cancels.lock().unwrap();
        if let Some(id) = message_id {
            if let Some(flag) = cancels.get(id) {
                flag.store(true, Ordering::Relaxed);
            }
        } else {
            for flag in cancels.values() {
                flag.store(true, Ordering::Relaxed);
            }
        }

        // Resolve any waiting tool channels with cancelled error so awaiting tasks exit promptly
        let mut map = self.map.lock().unwrap();
        for (_, sender) in map.drain() {
            let _ = sender.send(Err("Operation cancelled by user".to_string()));
        }
    }

    pub fn is_cancelled(&self, message_id: Option<&str>) -> bool {
        if self.active_cancel.load(Ordering::Relaxed) {
            return true;
        }
        if let Some(id) = message_id {
            let cancels = self.cancels.lock().unwrap();
            if let Some(flag) = cancels.get(id) {
                return flag.load(Ordering::Relaxed);
            }
        }
        false
    }

    pub fn remove_cancel(&self, message_id: &str) {
        let mut cancels = self.cancels.lock().unwrap();
        cancels.remove(message_id);
    }
}
