use async_trait::async_trait;
use std::sync::Arc;
use tauri::Emitter;
use super::LlmProvider;
use super::super::provider::LlmConfig;
use super::super::remote::ChatMessage;
use super::super::engine::LlamaEngine;

pub struct LocalProvider {
    engine: Arc<LlamaEngine>,
}

impl LocalProvider {
    pub fn new(engine: Arc<LlamaEngine>) -> Self {
        Self { engine }
    }
}

#[async_trait]
impl LlmProvider for LocalProvider {
    async fn generate(&self, prompt: &str, config: &LlmConfig) -> Result<String, String> {
        let system_prompt = config.system_prompt.as_deref();
        let formatted_prompt = wrap_generate_prompt(prompt, system_prompt);
        println!("[llm][local] Generating response for prompt ({} chars)", formatted_prompt.len());
        let engine = self.engine.clone();
        
        let result = tokio::task::spawn_blocking(move || {
            engine.generate(&formatted_prompt).map_err(|e| e.to_string())
        })
        .await
        .map_err(|e| format!("Task join error: {}", e))??;

        let cleaned_result = clean_model_output(&result);
        println!("[llm][local] Generation completed successfully ({} chars)", cleaned_result.len());
        Ok(cleaned_result)
    }

    async fn stream(
        &self,
        messages: &[ChatMessage],
        config: &LlmConfig,
        app: &tauri::AppHandle,
        cancel: Arc<std::sync::atomic::AtomicBool>,
    ) -> Result<(), String> {
        let prompt = build_chat_prompt(messages, config.system_prompt.as_deref());
        println!("[llm][local] Streaming chat response for prompt ({} chars)", prompt.len());
        
        let engine = self.engine.clone();
        let app_clone = app.clone();
        let cancel_clone = cancel.clone();

        let mut buffer = String::new();
        let mut in_tool_call = false;

        let (res, buffer) = tokio::task::spawn_blocking(move || {
            let res = engine.stream(&prompt, |piece| {
                buffer.push_str(piece);
                
                if !in_tool_call {
                    if let Some(pos) = buffer.find("<|tool_call>") {
                        let text_before = &buffer[..pos];
                        if !text_before.is_empty() {
                            let _ = app_clone.emit("llm-token", text_before);
                        }
                        buffer = buffer[pos..].to_string();
                        in_tool_call = true;
                    } else {
                        // Flush characters that cannot be part of the starting tag <|tool_call>
                        // <|tool_call> is 13 chars. If buffer is longer than 13, we can safely flush
                        // the prefix that doesn't match the tag.
                        if buffer.len() > 13 {
                            let tag_prefix = "<|tool_call>";
                            // Find the longest match of buffer's end with start of tag_prefix
                            let mut match_len = 0;
                            for len in (1..13).rev() {
                                if buffer.ends_with(&tag_prefix[..len]) {
                                    match_len = len;
                                    break;
                                }
                            }
                            let flush_len = buffer.len() - match_len;
                            if flush_len > 0 {
                                let flush_text: String = buffer.chars().take(flush_len).collect();
                                let _ = app_clone.emit("llm-token", &flush_text);
                                buffer = buffer.chars().skip(flush_len).collect();
                            }
                        }
                    }
                } else {
                    if let Some(pos) = buffer.find("<tool_call|>") {
                        let end_pos = pos + "<tool_call|>".len();
                        let tool_block = &buffer[..end_pos];
                        
                        if let Some(parsed) = parse_and_map_local_tool_call(tool_block) {
                            println!("[llm][local] Extracted tool call: {:?}", parsed);
                            let _ = app_clone.emit("llm-tool-call-pending", parsed);
                        } else {
                            let _ = app_clone.emit("llm-token", tool_block);
                        }
                        
                        buffer = buffer[end_pos..].to_string();
                        in_tool_call = false;
                    }
                }
                
                Ok(!cancel_clone.load(std::sync::atomic::Ordering::Relaxed))
            });
            (res, buffer)
        })
        .await
        .map_err(|e| format!("Task join error: {}", e))?;

        res.map_err(|e| e.to_string())?;

        // Flush any remaining tokens at the end of the stream
        if !buffer.is_empty() {
            let _ = app.emit("llm-token", &buffer);
        }

        println!("[llm][local] Stream finished");
        let _ = app.emit("llm-done", ());
        Ok(())
    }
}

fn build_chat_prompt(messages: &[ChatMessage], system_prompt: Option<&str>) -> String {
    let mut prompt = String::new();

    if let Some(sys) = system_prompt {
        prompt.push_str(&format!("<|system|>\n{sys}\n"));
    }

    for msg in messages {
        match msg.role.as_str() {
            "user" => {
                prompt.push_str(&format!("<|user|>\n{}\n", msg.content));
            }
            "assistant" => {
                prompt.push_str(&format!("<|assistant|>\n{}\n", msg.content));
            }
            "tool" => {
                prompt.push_str(&format!("<|tool_response|>{}\n", msg.content));
            }
            _ => {}
        }
    }

    // If the last message is not assistant, append <|assistant|> to prompt it to answer
    if let Some(last) = messages.last() {
        if last.role != "assistant" {
            prompt.push_str("<|assistant|>\n");
        }
    } else {
        prompt.push_str("<|assistant|>\n");
    }

    prompt
}

fn wrap_generate_prompt(prompt: &str, system_prompt: Option<&str>) -> String {
    let mut wrapped = String::new();
    if let Some(sys) = system_prompt {
        wrapped.push_str(&format!("<|system|>\n{sys}\n"));
    }
    wrapped.push_str(&format!("<|user|>\n{prompt}\n<|assistant|>\n"));
    wrapped
}

fn clean_model_output(output: &str) -> String {
    let mut cleaned = output.trim();
    if cleaned.starts_with("<|assistant|>") {
        cleaned = cleaned.trim_start_matches("<|assistant|>").trim();
    }
    if cleaned.ends_with("<|end|>") {
        cleaned = cleaned.trim_end_matches("<|end|>").trim();
    }
    cleaned.to_string()
}

fn parse_and_map_local_tool_call(block: &str) -> Option<serde_json::Value> {
    use serde_json::json;

    let content = block
        .strip_prefix("<|tool_call>")?
        .strip_suffix("<tool_call|>")?
        .trim();

    let brace_pos = content.find('{')?;
    let raw_name = content[..brace_pos].trim();
    let raw_args = content[brace_pos..].trim();

    let mapped_name = match raw_name {
        "call:google:search" | "google:search" | "search" => "web_search",
        other => other,
    };

    let cleaned_args = fix_relaxed_json(raw_args);

    if let Ok(mut args_val) = serde_json::from_str::<serde_json::Value>(&cleaned_args) {
        if mapped_name == "web_search" {
            if let Some(queries) = args_val.get("queries").and_then(|q| q.as_array()) {
                if let Some(first_query) = queries.first().and_then(|q| q.as_str()) {
                    args_val = json!({ "query": first_query });
                }
            } else if let Some(query) = args_val.get("query").and_then(|q| q.as_str()) {
                args_val = json!({ "query": query });
            }
        }
        
        Some(json!({
            "name": mapped_name,
            "args": args_val.to_string(),
        }))
    } else {
        println!("[llm][local] Failed to parse tool call JSON: {}", cleaned_args);
        None
    }
}

fn fix_relaxed_json(input: &str) -> String {
    let mut out = input.to_string();
    // Replace GGUF specific string literal escapes (e.g. <|"|> to ")
    out = out.replace("<|\"|>", "\"");
    
    if !out.contains("\"queries\":") && out.contains("queries:") {
        out = out.replace("queries:", "\"queries\":");
    }
    if !out.contains("\"query\":") && out.contains("query:") {
        out = out.replace("query:", "\"query\":");
    }
    if !out.contains("\"path\":") && out.contains("path:") {
        out = out.replace("path:", "\"path\":");
    }
    if !out.contains("\"content\":") && out.contains("content:") {
        out = out.replace("content:", "\"content\":");
    }
    out
}
