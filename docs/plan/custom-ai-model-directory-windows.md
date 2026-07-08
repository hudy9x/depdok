# Custom GGUF Model Directory Configuration (Windows)

This plan details the changes required to allow Windows users to store downloaded local GGUF models in a custom directory. By default, the application saves model weights inside the user's `app_data_dir/llm-models`. When disk space is limited on the primary volume, users can configure a custom models folder in settings.

## Proposed Changes

We will modify the backend LLM configuration to accept a `custom_models_dir` option, update the models directory resolver to respect this configuration, and ensure that saving configuration changes unloads the existing in-memory LLM engine to force a reload. On the frontend, we will expose this folder picker to Windows users in the LLM Settings tab along with a notification advising them to move their GGUF files.

---

### [Component Name] Backend (Rust)

#### [MODIFY] [provider.rs](file:///Users/hudy/ws/depdok/src-tauri/src/llm/provider.rs)
- Update `LlmConfig` struct to include a new field `custom_models_dir: Option<String>`.
- Set `#[serde(default)]` on `custom_models_dir` to ensure backward compatibility.
- Update `impl Default for LlmConfig` to initialize `custom_models_dir: None`.

#### [MODIFY] [models.rs](file:///Users/hudy/ws/depdok/src-tauri/src/llm/models.rs)
- Update `get_models_dir(app: &AppHandle)` to check for `custom_models_dir` in `LlmState` configuration.
- If the configuration is not loaded in `LlmState` yet (e.g., during startup tasks), attempt to read `custom_models_dir` directly from the `store.json` file.
- If a custom directory is specified and is non-empty, use it as the models directory instead of the default `app_data_dir/llm-models`.

#### [MODIFY] [config.rs](file:///Users/hudy/ws/depdok/src-tauri/src/llm/settings/config.rs)
- In `save_llm_config`, reset the active in-memory engine by setting `*state.engine.lock().unwrap() = None;`. This unloads the old model immediately when LLM configuration changes, ensuring the new model path and settings are applied upon the next loading or chat generation request.

---

### [Component Name] Frontend (React / Vite)

#### [MODIFY] [llm.ts](file:///Users/hudy/ws/depdok/src/features/LLMChat/api/llm.ts)
- Update the frontend `LlmConfig` interface to include `custom_models_dir: string | null`.

#### [MODIFY] [LLMModelSetting.tsx](file:///Users/hudy/ws/depdok/src/features/LLMChat/settings/LLMModelSetting.tsx)
- Import `platform` from `@tauri-apps/plugin-os` to detect if the OS is Windows.
- Import `openFolderDialog` from `../../FileExplorer/api`.
- Add local state `customModelsDir` and sync it from the loaded `config`.
- Render a new section "Models Storage Location" inside the Local provider settings panel if `platform() === "windows"`.
- Provide a "Choose..." button that opens `openFolderDialog()` to let the user select a custom directory.
- Provide a "Reset" button to revert to the default location.
- Render a notification/notice when `customModelsDir` is configured or changed, informing the user:
  > **Notice:** The models folder has been customized. Existing models must be manually copied to the new folder, or downloaded again.
  > Default location: `[Default App Data Path]/llm-models`
- Include `custom_models_dir` when saving configuration, and trigger a model list refresh (`refreshModels()`) immediately after saving so the list updates.

---

## Verification Plan

### Automated/Manual Tests
- Build and run the app.
- Open LLM Settings.
- On Windows:
  1. Verify the "Models Storage Location" setting is visible and defaults to "Default (App Data Folder)".
  2. Click "Choose..." and select a custom empty directory on another volume/folder (e.g., `D:\llm_models` or a test folder).
  3. Verify the notice alert is shown explaining that existing models need to be manually copied.
  4. Click "Save Configuration".
  5. Verify that:
     - The models list updates to show it is empty.
     - The loaded LLM engine is unloaded (can verify by watching log output/console).
     - The download of a new model goes into the newly selected directory.
     - The "Reveal Models Folder" button opens the new custom directory in Windows Explorer.
  6. Copy a `.gguf` file to the new folder, click refresh/re-open, and verify the model appears.
  7. Click "Reset" and then "Save Configuration". Verify it reverts back to the default directory and scans existing models.
- On macOS/Linux:
  - Verify the setting is hidden/not visible.
