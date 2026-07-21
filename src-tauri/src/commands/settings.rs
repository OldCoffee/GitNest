use rebased_core::AppSettings;
use tauri::State;
use tauri_plugin_store::StoreExt;

use crate::state::SharedState;

const SETTINGS_KEY: &str = "settings.json";
const CURRENT_SCHEMA_VERSION: u32 = 1;

fn persist(app: &tauri::AppHandle, settings: &AppSettings) -> Result<(), String> {
    let store = app.store(SETTINGS_KEY).map_err(|e| e.to_string())?;
    store.set(
        "settings",
        serde_json::to_value(settings).map_err(|e| e.to_string())?,
    );
    store.save().map_err(|e| e.to_string())
}

fn migrate(mut settings: AppSettings) -> (AppSettings, bool) {
    let mut changed = false;
    if settings.schema_version < CURRENT_SCHEMA_VERSION {
        settings.schema_version = CURRENT_SCHEMA_VERSION;
        changed = true;
    }
    (settings, changed)
}

#[tauri::command]
pub fn get_settings(app: tauri::AppHandle) -> Result<AppSettings, String> {
    let store = app.store(SETTINGS_KEY).map_err(|e| e.to_string())?;
    let loaded = if let Some(value) = store.get("settings") {
        serde_json::from_value(value).map_err(|e| e.to_string())?
    } else {
        AppSettings::default()
    };
    let (settings, changed) = migrate(loaded);
    if changed {
        persist(&app, &settings)?;
    }
    Ok(settings)
}

#[tauri::command]
pub fn save_settings(
    mut settings: AppSettings,
    app: tauri::AppHandle,
    state: State<'_, SharedState>,
) -> Result<(), String> {
    settings.schema_version = CURRENT_SCHEMA_VERSION;
    persist(&app, &settings)?;
    *state.settings.lock() = settings;
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
    persist(&app, &settings)
}
