use tauri::{AppHandle, State};
use crate::llm::provider::LlmState;
use crate::llm::providers::get_provider;
use crate::llm::settings::config::load_config_internal;

#[tauri::command]
pub async fn grammar_correct_text(
    app: AppHandle,
    text: String,
    state: State<'_, LlmState>,
) -> Result<String, String> {
    println!("[llm][command] grammar_correct_text requested: input ({} chars)", text.len());
    let prompt = format!(
        "Fix the grammar and style of the following text. \
         Return ONLY the corrected text with no explanation, \
         no quotes, and no extra commentary:\n\n{text}"
    );

    // Bootstraps state from disk store if config hasn't been loaded in memory yet
    let config = load_config_internal(&app, &state);
    let provider = get_provider(&config, &state).await?;
    
    let start_time = std::time::Instant::now();
    let result = provider.generate(&prompt, &config).await?;
    let duration = start_time.elapsed();
    
    println!(
        "[llm][grammar] Grammar correction completed in {:?}. Output length: {} chars",
        duration,
        result.len()
    );
    Ok(result)
}

#[tauri::command]
pub async fn edit_text_with_ai(
    app: AppHandle,
    text: String,
    instruction: String,
    state: State<'_, LlmState>,
) -> Result<String, String> {
    println!(
        "[llm][command] edit_text_with_ai requested: instruction='{}' input=({} chars)",
        instruction,
        text.len()
    );

    let prompt = format!(
        "{instruction}\n\
         Return ONLY the resulting text with no explanation, \
         no quotes, and no extra commentary:\n\n{text}"
    );

    let config = load_config_internal(&app, &state);
    let provider = get_provider(&config, &state).await?;

    let start_time = std::time::Instant::now();
    let result = provider.generate(&prompt, &config).await?;
    let duration = start_time.elapsed();

    println!(
        "[llm][edit] AI edit completed in {:?}. Output length: {} chars",
        duration,
        result.len()
    );
    Ok(result)
}
