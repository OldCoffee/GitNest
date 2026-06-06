use rebased_core::{fetch, list_remotes, pull, push, RemoteInfo, RemoteOperationResult};
use tauri::State;

use crate::state::SharedState;

#[tauri::command]
pub fn get_remotes(state: State<'_, SharedState>) -> Result<Vec<RemoteInfo>, String> {
    state.with_repo(|repo| list_remotes(repo.path(), repo.git()))
}

async fn run_remote_blocking<F>(
    state: State<'_, SharedState>,
    op: F,
) -> Result<RemoteOperationResult, String>
where
    F: FnOnce(&std::path::Path, &rebased_core::GitCli) -> rebased_core::Result<RemoteOperationResult>
        + Send
        + 'static,
{
    let (path, git) = state.repo_handle()?;
    tauri::async_runtime::spawn_blocking(move || op(&path, &git))
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn git_fetch(
    remote: String,
    state: State<'_, SharedState>,
) -> Result<RemoteOperationResult, String> {
    run_remote_blocking(state, move |path, git| fetch(path, git, &remote)).await
}

#[tauri::command]
pub async fn git_pull(
    remote: String,
    branch: String,
    state: State<'_, SharedState>,
) -> Result<RemoteOperationResult, String> {
    run_remote_blocking(state, move |path, git| pull(path, git, &remote, &branch)).await
}

#[tauri::command]
pub async fn git_push(
    remote: String,
    branch: String,
    state: State<'_, SharedState>,
) -> Result<RemoteOperationResult, String> {
    run_remote_blocking(state, move |path, git| push(path, git, &remote, &branch)).await
}
