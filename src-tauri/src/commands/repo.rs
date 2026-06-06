use std::path::PathBuf;

use rebased_core::{open_repo, GitCli, RepoInfo};
use tauri::State;
use tauri_plugin_store::StoreExt;

use crate::state::SharedState;

#[tauri::command]
pub fn open_repository(
    path: String,
    state: State<'_, SharedState>,
    app: tauri::AppHandle,
) -> Result<RepoInfo, String> {
    let settings = state.settings_snapshot();
    let repo = open_repo(&path, Some(&settings.git_path)).map_err(|e| e.to_string())?;
    let info = repo.info().map_err(|e| e.to_string())?;
    *state.repo.lock() = Some(repo);
    state.add_recent_repo(&info.path);
    let updated = state.settings_snapshot();
    let store = app.store("settings.json").map_err(|e| e.to_string())?;
    store.set(
        "settings",
        serde_json::to_value(&updated).map_err(|e| e.to_string())?,
    );
    store.save().map_err(|e| e.to_string())?;
    Ok(info)
}

fn resolve_folder(path: &str) -> Result<PathBuf, String> {
    let path = PathBuf::from(path)
        .canonicalize()
        .map_err(|e| format!("invalid path: {e}"))?;
    if !path.is_dir() {
        return Err("path is not a directory".into());
    }
    Ok(path)
}

#[tauri::command]
pub fn is_git_repository(path: String) -> Result<bool, String> {
    let path = resolve_folder(&path)?;
    Ok(path.join(".git").exists())
}

#[tauri::command]
pub fn init_git_repository(path: String, state: State<'_, SharedState>) -> Result<(), String> {
    let path = resolve_folder(&path)?;
    let settings = state.settings_snapshot();
    let git = GitCli::new(settings.git_path);
    git.run_ok(&path, &["init"]).map(|_| ()).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_repo_info(state: State<'_, SharedState>) -> Result<RepoInfo, String> {
    state.with_repo(|repo| repo.info())
}

#[tauri::command]
pub fn close_repository(state: State<'_, SharedState>) {
    *state.repo.lock() = None;
}

/// Launch a new independent application window as a separate process so the
/// user can open another repository side by side.
#[tauri::command]
pub fn open_new_window() -> Result<(), String> {
    let exe = std::env::current_exe().map_err(|e| e.to_string())?;
    std::process::Command::new(exe)
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}
