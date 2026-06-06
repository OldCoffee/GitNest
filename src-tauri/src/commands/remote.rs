use rebased_core::{fetch, list_remotes, pull, push, RemoteInfo, RemoteOperationResult};
use tauri::State;

use crate::state::SharedState;

#[tauri::command]
pub fn get_remotes(state: State<'_, SharedState>) -> Result<Vec<RemoteInfo>, String> {
    state.with_repo(|repo| list_remotes(repo.path(), repo.git()))
}

#[tauri::command]
pub fn git_fetch(remote: String, state: State<'_, SharedState>) -> Result<RemoteOperationResult, String> {
    state.with_repo(|repo| fetch(repo.path(), repo.git(), &remote))
}

#[tauri::command]
pub fn git_pull(
    remote: String,
    branch: String,
    state: State<'_, SharedState>,
) -> Result<RemoteOperationResult, String> {
    state.with_repo(|repo| pull(repo.path(), repo.git(), &remote, &branch))
}

#[tauri::command]
pub fn git_push(
    remote: String,
    branch: String,
    state: State<'_, SharedState>,
) -> Result<RemoteOperationResult, String> {
    state.with_repo(|repo| push(repo.path(), repo.git(), &remote, &branch))
}
