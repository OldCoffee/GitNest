use rebased_core::{fetch, list_remotes, pull, push, RemoteInfo, RemoteOperationResult};
use tauri::State;

use super::blocking::{run_git_mutation, run_git_read};
use super::repo_path::{optional_repo_path, repo_handle};
use crate::state::SharedState;

#[tauri::command]
pub async fn get_remotes(
    repo_path: Option<String>,
    state: State<'_, SharedState>,
) -> Result<Vec<RemoteInfo>, String> {
    let handle = repo_handle(repo_path, &state)?;
    run_git_read(handle, |path, git| {
        list_remotes(&path, &git).map_err(|e| e.to_string())
    })
    .await
}

#[tauri::command]
pub async fn git_fetch(
    remote: String,
    repo_path: Option<String>,
    state: State<'_, SharedState>,
) -> Result<RemoteOperationResult, String> {
    run_git_mutation(
        state.git_service.clone(),
        optional_repo_path(repo_path),
        move |path, git| fetch(&path, &git, &remote).map_err(|e| e.to_string()),
    )
    .await
}

#[tauri::command]
pub async fn git_pull(
    remote: String,
    branch: String,
    repo_path: Option<String>,
    state: State<'_, SharedState>,
) -> Result<RemoteOperationResult, String> {
    run_git_mutation(
        state.git_service.clone(),
        optional_repo_path(repo_path),
        move |path, git| pull(&path, &git, &remote, &branch).map_err(|e| e.to_string()),
    )
    .await
}

#[tauri::command]
pub async fn git_push(
    remote: String,
    branch: String,
    repo_path: Option<String>,
    state: State<'_, SharedState>,
) -> Result<RemoteOperationResult, String> {
    run_git_mutation(
        state.git_service.clone(),
        optional_repo_path(repo_path),
        move |path, git| push(&path, &git, &remote, &branch).map_err(|e| e.to_string()),
    )
    .await
}
