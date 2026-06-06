use rebased_core::AppSettings;
use tauri::State;
use tauri_plugin_store::StoreExt;

use crate::state::SharedState;

const SETTINGS_KEY: &str = "settings.json";

#[tauri::command]
pub fn get_settings(app: tauri::AppHandle) -> Result<AppSettings, String> {
    let store = app.store(SETTINGS_KEY).map_err(|e| e.to_string())?;
    if let Some(value) = store.get("settings") {
        serde_json::from_value(value).map_err(|e| e.to_string())
    } else {
        Ok(AppSettings::default())
    }
}

#[tauri::command]
pub fn save_settings(
    settings: AppSettings,
    app: tauri::AppHandle,
    state: State<'_, SharedState>,
) -> Result<(), String> {
    let store = app.store(SETTINGS_KEY).map_err(|e| e.to_string())?;
    store.set(
        "settings",
        serde_json::to_value(&settings).map_err(|e| e.to_string())?,
    );
    store.save().map_err(|e| e.to_string())?;
    *state.settings.lock() = settings.clone();
    Ok(())
}

#[tauri::command]
pub fn get_recent_repos(app: tauri::AppHandle) -> Result<Vec<String>, String> {
    let settings = get_settings(app)?;
    Ok(settings.recent_repos)
}

#[tauri::command]
pub fn clear_recent_repos(
    app: tauri::AppHandle,
    state: State<'_, SharedState>,
) -> Result<(), String> {
    state.clear_recent_repos();
    let settings = state.settings_snapshot();
    let store = app.store(SETTINGS_KEY).map_err(|e| e.to_string())?;
    store.set(
        "settings",
        serde_json::to_value(&settings).map_err(|e| e.to_string())?,
    );
    store.save().map_err(|e| e.to_string())
}
