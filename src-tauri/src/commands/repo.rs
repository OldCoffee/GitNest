use std::path::{Path, PathBuf};

use rebased_core::{open_repo, GitCli, RepoInfo};
use tauri::State;
use tauri_plugin_store::StoreExt;

use super::repo_path::repo_handle;
use crate::state::SharedState;

fn teardown_open_repo(state: &SharedState) {
    let _ = state.terminals.close_all();
    state.git_service.clear();
    state.workspace.set_root(None);
    state.asset_scope.clear_current();
    *state.repo.lock() = None;
}

fn looks_like_git_root(path: &Path) -> bool {
    path.join(".git").exists()
}

fn register_git_root(state: &SharedState, path: &Path) -> Result<(), String> {
    let settings = state.settings_snapshot();
    let git = GitCli::new(settings.git_path);
    // Validate the directory is a usable git work tree.
    git.run_ok(path, &["rev-parse", "--is-inside-work-tree"])
        .map_err(|e| e.to_string())?;
    state.git_service.register(path, git);
    Ok(())
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

    let repo_path = repo.path().to_path_buf();
    state
        .git_service
        .register(&repo_path, repo.git().clone());
    state
        .git_service
        .set_active(&repo_path)
        .map_err(|e| e.to_string())?;
    state.workspace.set_root(Some(repo_path.clone()));
    if let Err(error) = state.asset_scope.allow_repo(&app, &repo_path) {
        tracing::warn!(%error, path = %repo_path.display(), "Failed to expand asset protocol scope for repo");
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
pub async fn get_repo_info(
    repo_path: Option<String>,
    state: State<'_, SharedState>,
) -> Result<RepoInfo, String> {
    let handle = repo_handle(repo_path, &state)?;
    crate::commands::blocking::run_git_read(handle, |path, git| {
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

#[tauri::command]
pub fn list_workspace_roots(state: State<'_, SharedState>) -> Result<Vec<String>, String> {
    Ok(state
        .workspace
        .roots()
        .into_iter()
        .map(|path| path.to_string_lossy().into_owned())
        .collect())
}

#[tauri::command]
pub fn add_workspace_folder(
    path: String,
    state: State<'_, SharedState>,
    app: tauri::AppHandle,
) -> Result<Vec<String>, String> {
    if state.workspace.roots().is_empty() {
        return Err("open a repository before adding workspace folders".into());
    }
    let roots = state.workspace.add_root(PathBuf::from(&path).as_path())?;
    if let Some(added) = roots.last() {
        if let Err(error) = state.asset_scope.allow_path(&app, added) {
            tracing::warn!(%error, path = %added.display(), "Failed to expand asset protocol scope");
        }
        if looks_like_git_root(added) {
            if let Err(error) = register_git_root(&state, added) {
                tracing::warn!(%error, path = %added.display(), "Failed to register git root");
            }
        }
    }
    Ok(roots
        .into_iter()
        .map(|path| path.to_string_lossy().into_owned())
        .collect())
}

#[tauri::command]
pub fn remove_workspace_folder(
    path: String,
    state: State<'_, SharedState>,
) -> Result<Vec<String>, String> {
    let target = PathBuf::from(&path);
    let canonical = target.canonicalize().unwrap_or_else(|_| target.clone());
    if state.git_service.active_path().as_ref() == Some(&canonical) {
        return Err(
            "cannot remove the active git root; activate another root or close the repository first"
                .into(),
        );
    }
    state.git_service.unregister(&canonical);
    let roots = state.workspace.remove_root(canonical.as_path())?;
    Ok(roots
        .into_iter()
        .map(|path| path.to_string_lossy().into_owned())
        .collect())
}

#[tauri::command]
pub async fn activate_git_root(
    path: String,
    state: State<'_, SharedState>,
) -> Result<RepoInfo, String> {
    let canonical = resolve_folder(&path)?;
    if !state.workspace.contains_root(&canonical) {
        return Err("path is not a workspace root".into());
    }
    if !looks_like_git_root(&canonical) {
        return Err("path is not a git repository".into());
    }

    if !state.git_service.is_registered(&canonical) {
        register_git_root(&state, &canonical)?;
    }

    let settings = state.settings_snapshot();
    let git_path = settings.git_path.clone();
    let open_path = canonical.clone();
    let (repo, info) = tauri::async_runtime::spawn_blocking(move || {
        let repo = open_repo(&open_path, Some(&git_path)).map_err(|e| e.to_string())?;
        let info = repo.info().map_err(|e| e.to_string())?;
        Ok::<_, String>((repo, info))
    })
    .await
    .map_err(|e| e.to_string())??;

    state
        .git_service
        .set_active(repo.path())
        .map_err(|e| e.to_string())?;
    state.workspace.promote_to_front(repo.path())?;
    *state.repo.lock() = Some(repo);
    state.add_recent_repo(&info.path);
    Ok(info)
}
