---
trigger: always_on
---

# Windows Path Safety

## Scope
Applies to save/create/rename/move flows that handle file paths on Windows.

## Rules
- Never build file paths with raw string concatenation (for example `${base}/${name}` or `${workspace}-${subpath}`).
- Normalize Windows paths before write operations: convert `/` to `\\` and preserve valid drive-letter forms.
- Detect and repair malformed patterns like `<workspace>-<subpath>` before writing.
- Do not use `@tauri-apps/plugin-fs` for editor save writes on Windows.
- Use app Rust file commands through frontend wrappers (for example `write_file_content`) for save operations, because plugin-fs can reject malformed or scope-mismatched paths with `forbidden path` even when the app-level path is otherwise expected.
- When saving UNTITLED files, sanitize to basename only before opening Save dialog.

## Rust Save Command Reference
Use this command on the Rust side for text saves:

```rust
#[tauri::command]
pub fn write_file_content(path: &str, content: &str) -> Result<(), String> {
	fs::write(path, content).map_err(|e| e.to_string())
}
```

Frontend save handlers should call this through a wrapper in src/lib/fileOperations.ts.

## Capability Reference (default.json)
Keep these permissions available for save/open flows in src-tauri/capabilities/default.json:

- core:default
- dialog:allow-open
- dialog:allow-save
- dialog:default
- fs:default
- fs:allow-app-read
- fs:allow-app-write
- fs:allow-app-write-recursive
- fs:allow-home-read-recursive
- fs:allow-home-write-recursive
- fs:read-all
- fs:write-all

## Regression Guard
- If a path looks like `D:\\workspace-subdir/file.md`, rewrite to `D:\\workspace\\subdir\\file.md` before write.
- Add or keep lightweight logs around save path normalization when debugging Windows-only save failures.
