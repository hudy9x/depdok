use std::env;
use std::fs;
use std::path::{Path, PathBuf};

use serde::Deserialize;

#[derive(Debug, Clone, Default, Deserialize)]
#[allow(dead_code)]
pub struct FileConfig {
    #[serde(default)]
    pub database_path: Option<PathBuf>,
    #[serde(default)]
    pub cache_dir: Option<PathBuf>,
    #[serde(default)]
    pub write_enabled: Option<bool>,
    #[serde(default)]
    pub default_group_id: Option<String>,
    #[serde(default)]
    pub protocol_version: Option<String>,
    #[serde(default)]
    pub server_name: Option<String>,
    #[serde(default)]
    pub server_version: Option<String>,
}

#[derive(Debug, Clone)]
pub struct McpServerConfig {
    pub database_path: PathBuf,
    pub cache_dir: PathBuf,
    pub server_name: String,
    pub server_version: String,
}

impl McpServerConfig {
    pub fn load() -> Result<Self, String> {
        let cli = CliArgs::parse();
        let file_config = if let Some(path) = cli.config_path.as_deref() {
            read_file_config(path)?
        } else if let Some(path) = env::var_os("DEPDOK_MCP_CONFIG") {
            read_file_config(Path::new(&path))?
        } else {
            FileConfig::default()
        };

        let database_path = cli
            .database_path
            .or_else(|| env::var_os("DEPDOK_MCP_DB_PATH").map(PathBuf::from))
            .or(file_config.database_path)
            .unwrap_or_else(default_database_path);

        let cache_dir = cli
            .cache_dir
            .or_else(|| env::var_os("DEPDOK_MCP_CACHE_DIR").map(PathBuf::from))
            .or(file_config.cache_dir)
            .unwrap_or_else(default_cache_dir);

        let server_name = file_config
            .server_name
            .or_else(|| env::var("DEPDOK_MCP_SERVER_NAME").ok())
            .unwrap_or_else(|| "depdok".to_string());

        let server_version = file_config
            .server_version
            .or_else(|| env::var("DEPDOK_MCP_SERVER_VERSION").ok())
            .unwrap_or_else(|| env!("CARGO_PKG_VERSION").to_string());

        Ok(Self {
            database_path,
            cache_dir,
            server_name,
            server_version,
        })
    }
}

#[derive(Debug, Default)]
struct CliArgs {
    config_path: Option<PathBuf>,
    database_path: Option<PathBuf>,
    cache_dir: Option<PathBuf>,
    write_enabled: Option<bool>,
    default_group_id: Option<String>,
    protocol_version: Option<String>,
}

impl CliArgs {
    fn parse() -> Self {
        let mut args = env::args().skip(1);
        let mut cli = Self::default();

        while let Some(arg) = args.next() {
            match arg.as_str() {
                "--config" => cli.config_path = args.next().map(PathBuf::from),
                "--db-path" => cli.database_path = args.next().map(PathBuf::from),
                "--cache-dir" => cli.cache_dir = args.next().map(PathBuf::from),
                "--default-group-id" => cli.default_group_id = args.next(),
                "--protocol-version" => cli.protocol_version = args.next(),
                "--write-enabled" => cli.write_enabled = Some(true),
                "--read-only" => cli.write_enabled = Some(false),
                _ => {}
            }
        }

        cli
    }
}

fn read_file_config(path: &Path) -> Result<FileConfig, String> {
    let content = fs::read_to_string(path)
        .map_err(|e| format!("Failed to read MCP config file {}: {e}", path.display()))?;
    serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse MCP config file {}: {e}", path.display()))
}

fn default_database_path() -> PathBuf {
    default_data_dir().join("knowledge_base.db")
}

fn default_cache_dir() -> PathBuf {
    default_data_dir().join("cache")
}

fn default_data_dir() -> PathBuf {
    #[cfg(target_os = "macos")]
    {
        env::var_os("HOME")
            .map(PathBuf::from)
            .unwrap_or_else(|| PathBuf::from("."))
            .join("Library/Application Support/com.depdok.app")
    }

    #[cfg(target_os = "windows")]
    {
        env::var_os("APPDATA")
            .map(PathBuf::from)
            .unwrap_or_else(|| PathBuf::from("."))
            .join("com.depdok.app")
    }

    #[cfg(all(not(target_os = "macos"), not(target_os = "windows")))]
    {
        if let Some(dir) = env::var_os("XDG_DATA_HOME") {
            return PathBuf::from(dir).join("com.depdok.app");
        }

        env::var_os("HOME")
            .map(PathBuf::from)
            .unwrap_or_else(|| PathBuf::from("."))
            .join(".local/share/com.depdok.app")
    }
}