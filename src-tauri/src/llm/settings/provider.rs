use tauri::State;
use crate::llm::provider::{LlmState, LlmProviderStatus, ProviderType};
use crate::llm::providers::ensure_engine;

#[tauri::command]
pub async fn load_llm_provider(
    state: State<'_, LlmState>,
) -> Result<(), String> {
    let config = state.config.lock().unwrap().clone();
    println!("[llm][command] load_llm_provider requested: {:?}", config.provider_type);

    match config.provider_type {
        ProviderType::Local => {
            ensure_engine(&state).await.map(|_| ())
        }
        // Remote providers don't need pre-loading
        _ => {
            println!("[llm][provider] Remote provider selected, clearing local engine from memory");
            *state.engine.lock().unwrap() = None;
            Ok(())
        }
    }
}

#[tauri::command]
pub fn unload_llm_provider(state: State<'_, LlmState>) -> Result<(), String> {
    println!("[llm][command] unload_llm_provider requested (unloading GGUF model if loaded)");
    *state.engine.lock().unwrap() = None;
    Ok(())
}

#[tauri::command]
pub fn get_llm_provider_status(state: State<'_, LlmState>) -> LlmProviderStatus {
    let engine = state.engine.lock().unwrap();
    let config = state.config.lock().unwrap();
    let is_loaded = engine.is_some() || !matches!(config.provider_type, ProviderType::Local);
    
    LlmProviderStatus {
        loaded: is_loaded,
        provider_type: config.provider_type.clone(),
        model_name: config.model_name.clone().or_else(|| {
            config
                .local_model_path
                .as_ref()
                .and_then(|p| std::path::Path::new(p).file_name())
                .map(|n| n.to_string_lossy().to_string())
        }),
    }
}
