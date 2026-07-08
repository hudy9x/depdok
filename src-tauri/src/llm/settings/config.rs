use tauri::{AppHandle, State};
use tauri_plugin_store::StoreExt;
use crate::llm::provider::{LlmConfig, LlmState, ProviderType};
use crate::llm::models;

pub fn load_config_internal(
    app: &AppHandle,
    state: &LlmState,
) -> LlmConfig {
    let mut config = {
        let lock = state.config.lock().unwrap();
        lock.clone()
    };

    // If it is the default/empty config in memory (no local model path, endpoint or api key configured),
    // load it from the store instead.
    if config.local_model_path.is_none() && config.api_endpoint.is_none() && config.api_key.is_none() {
        if let Ok(store) = app.store("store.json") {
            if let Some(val) = store.get("llm_config") {
                if let Ok(saved) = serde_json::from_value::<LlmConfig>(val) {
                    config = saved;
                }
            }
        }
    }

    let is_new = config.local_model_path.is_none() && config.api_endpoint.is_none() && config.api_key.is_none();

    // Auto-detect first model if provider is Local and path is None
    if config.provider_type == ProviderType::Local && config.local_model_path.is_none() {
        println!("[llm][config] No model path configured. Scanning models folder...");
        if let Ok(models) = models::scan_models(app) {
            if !models.is_empty() {
                let default_path = models[0].path.clone();
                println!("[llm][config] Auto-detected local GGUF model: {}", default_path);
                config.local_model_path = Some(default_path);
                // Save it back to store
                if let Ok(store) = app.store("store.json") {
                    if let Ok(json) = serde_json::to_value(&config) {
                        let _ = store.set("llm_config", json);
                        let _ = store.save();
                    }
                }
            } else {
                println!("[llm][config] No local GGUF models found in models folder");
            }
        }
    } else if is_new {
        // Save default config back to store if it wasn't there
        if let Ok(store) = app.store("store.json") {
            if let Ok(json) = serde_json::to_value(&config) {
                let _ = store.set("llm_config", json);
                let _ = store.save();
            }
        }
    }

    // Sync in-memory config
    *state.config.lock().unwrap() = config.clone();
    config
}

#[tauri::command]
pub fn get_llm_config(
    app: AppHandle,
    state: State<'_, LlmState>,
) -> Result<LlmConfig, String> {
    println!("[llm][command] get_llm_config requested");
    Ok(load_config_internal(&app, &state))
}

#[tauri::command]
pub fn save_llm_config(
    app: AppHandle,
    state: State<'_, LlmState>,
    config: LlmConfig,
) -> Result<(), String> {
    println!("[llm][command] save_llm_config: provider={:?}, model={:?}", config.provider_type, config.model_name);
    // Persist to store
    if let Ok(store) = app.store("store.json") {
        let json =
            serde_json::to_value(&config).map_err(|e| format!("Serialize error: {}", e))?;
        let _ = store.set("llm_config", json);
        let _ = store.save();
    }
    *state.engine.lock().unwrap() = None;
    *state.config.lock().unwrap() = config;
    Ok(())
}
