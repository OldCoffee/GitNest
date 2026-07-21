use std::path::PathBuf;

use rebased_core::{open_repo, GitCli, RepoInfo};
use tauri::State;
use tauri_plugin_store::StoreExt;

use crate::state::SharedState;

fn teardown_open_repo(state: &SharedState) {
    let _ = state.terminals.close_all();
    state.git_service.set_handle(None);
    state.workspace.set_root(None);
    state.asset_scope.clear_current();
    *state.repo.lock() = None;
}

#[tauri::command]
#[tracing::instrument(skip(state, app), fields(path = %path))]
pub async fn open_repository(
    path: String,
    state: State<'_, SharedState>,
    app: tauri::AppHandle,
) -> Result<RepoInfo, String> {
    // Safe re-open / switch: reap terminals and clear the previous handle first.
    teardown_open_repo(&state);

    let settings = state.settings_snapshot();
    let git_path = settings.git_path.clone();

    // Heavy git / FS work off the IPC thread so the UI stays responsive.
    let (repo, info) = tauri::async_runtime::spawn_blocking(move || {
        let repo = open_repo(&path, Some(&git_path)).map_err(|e| e.to_string())?;
        let info = repo.info().map_err(|e| e.to_string())?;
        Ok::<_, String>((repo, info))
    })
    .await
    .map_err(|e| e.to_string())??;

    state
        .git_service
        .set_handle(Some((repo.path().to_path_buf(), repo.git().clone())));
    state.workspace.set_root(Some(repo.path().to_path_buf()));
    if let Err(error) = state.asset_scope.allow_repo(&app, repo.path()) {
        tracing::warn!(%error, path = %repo.path().display(), "Failed to expand asset protocol scope for repo");
    }
    *state.repo.lock() = Some(repo);
    state.add_recent_repo(&info.path);

    let updated = state.settings_snapshot();
    let app_for_store = app.clone();
    tauri::async_runtime::spawn(async move {
        let persist = tauri::async_runtime::spawn_blocking(move || -> Result<(), String> {
            let store = app_for_store
                .store("settings.json")
                .map_err(|e| e.to_string())?;
            store.set(
                "settings",
                serde_json::to_value(&updated).map_err(|e| e.to_string())?,
            );
            store.save().map_err(|e| e.to_string())
        })
        .await;
        match persist {
            Ok(Ok(())) => {}
            Ok(Err(error)) => tracing::warn!(%error, "Failed to persist recent repos after open"),
            Err(error) => tracing::warn!(%error, "Failed to persist recent repos after open"),
        }
    });

    // JDT / language server is started later by frontend warmStart — keep open snappy.
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
    git.run_ok(&path, &["init"])
        .map(|_| ())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_repo_info(state: State<'_, SharedState>) -> Result<RepoInfo, String> {
    crate::commands::blocking::run_git_read(state.git_service.handle()?, |path, git| {
        rebased_core::Repository::open(path, git)
            .and_then(|repo| repo.info())
            .map_err(|e| e.to_string())
    })
    .await
}

/// Cheap marker check — no directory listing / git check-ignore.
#[tauri::command]
pub fn project_has_java_markers(state: State<'_, SharedState>) -> Result<bool, String> {
    let root = state.workspace.root()?;
    Ok([
        "pom.xml",
        "build.gradle",
        "build.gradle.kts",
        "settings.gradle",
        "settings.gradle.kts",
    ]
    .iter()
    .any(|name| root.join(name).is_file()))
}

#[tauri::command]
pub fn close_repository(state: State<'_, SharedState>) {
    // Always reap PTY children here so closing a repo cannot leave zombie shells,
    // even if the frontend failed to call terminal_close / terminal_close_all.
    // Do not forbid asset paths: Tauri deny patterns permanently override allow.
    teardown_open_repo(&state);
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
