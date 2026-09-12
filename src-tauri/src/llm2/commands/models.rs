use serde::{Deserialize, Serialize};
#[cfg(any(target_os = "macos", target_os = "windows"))]
use std::process::Command;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OllamaModelInfo {
  pub name: String,
  pub size: Option<u64>,
  pub parameter_size: Option<String>,
  pub quantization_level: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct SystemProfile {
  pub os: String,
  pub architecture: String,
  pub total_memory_bytes: Option<u64>,
}

fn total_memory_bytes() -> Option<u64> {
  #[cfg(target_os = "macos")]
  {
    let output = Command::new("sysctl")
      .args(["-n", "hw.memsize"])
      .output()
      .ok()?;
    return String::from_utf8(output.stdout).ok()?.trim().parse().ok();
  }

  #[cfg(target_os = "windows")]
  {
    let output = Command::new("powershell")
      .args([
        "-NoProfile",
        "-Command",
        "(Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory",
      ])
      .output()
      .ok()?;
    let digits: String = String::from_utf8(output.stdout)
      .ok()?
      .chars()
      .filter(|character| character.is_ascii_digit())
      .collect();
    return digits.parse().ok();
  }

  #[cfg(target_os = "linux")]
  {
    let meminfo = std::fs::read_to_string("/proc/meminfo").ok()?;
    let memory_kib = meminfo
      .lines()
      .find_map(|line| line.strip_prefix("MemTotal:"))?
      .split_whitespace()
      .next()?
      .parse::<u64>()
      .ok()?;
    return memory_kib.checked_mul(1024);
  }

  #[allow(unreachable_code)]
  None
}

#[tauri::command]
pub fn llm2_get_system_profile() -> SystemProfile {
  SystemProfile {
    os: std::env::consts::OS.to_string(),
    architecture: std::env::consts::ARCH.to_string(),
    total_memory_bytes: total_memory_bytes(),
  }
}

#[tauri::command]
pub async fn llm2_list_models() -> Result<Vec<OllamaModelInfo>, String> {
  let client = reqwest::Client::new();
  let res = client
    .get("http://localhost:11434/api/tags")
    .send()
    .await
    .map_err(|e| format!("Cannot connect to Ollama (http://localhost:11434): {}", e))?;

  if !res.status().is_success() {
    return Err(format!("Ollama returned HTTP {}", res.status()));
  }

  let val: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
  let mut models = Vec::new();
  if let Some(arr) = val.get("models").and_then(|m| m.as_array()) {
    for item in arr {
      if let Some(name) = item.get("name").and_then(|n| n.as_str()) {
        let size = item.get("size").and_then(|s| s.as_u64());
        let parameter_size = item
          .get("details")
          .and_then(|d| d.get("parameter_size"))
          .and_then(|p| p.as_str())
          .map(|s| s.to_string());
        let quantization_level = item
          .get("details")
          .and_then(|d| d.get("quantization_level"))
          .and_then(|q| q.as_str())
          .map(|s| s.to_string());
        models.push(OllamaModelInfo {
          name: name.to_string(),
          size,
          parameter_size,
          quantization_level,
        });
      }
    }
  }
  Ok(models)
}
