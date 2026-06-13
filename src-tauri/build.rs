use std::fs;
use std::path::Path;

fn main() {
    // Ensure the resource paths exist to satisfy tauri-build validation during compilation.
    // In release builds, Cargo will subsequently compile the real binary and overwrite this placeholder.
    let release_dir = Path::new("target/release");
    if !release_dir.exists() {
        let _ = fs::create_dir_all(release_dir);
    }

    // Create placeholders for both macOS/Linux and Windows to support cross-compilation
    let mcp_macos = release_dir.join("depdok-mcp-server");
    if !mcp_macos.exists() {
        let _ = fs::write(&mcp_macos, "");
    }

    let mcp_windows = release_dir.join("depdok-mcp-server.exe");
    if !mcp_windows.exists() {
        let _ = fs::write(&mcp_windows, "");
    }

    tauri_build::build();
}
