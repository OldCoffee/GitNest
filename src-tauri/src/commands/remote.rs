use rebased_core::{fetch, list_remotes, pull, push, RemoteInfo, RemoteOperationResult};
use tauri::State;

use super::blocking::{run_git_mutation, run_git_read};
use crate::state::SharedState;

#[tauri::command]
pub async fn get_remotes(state: State<'_, SharedState>) -> Result<Vec<RemoteInfo>, String> {
    run_git_read(state.git_service.handle()?, |path, git| {
        list_remotes(&path, &git).map_err(|e| e.to_string())
    })
    .await
}

#[tauri::command]
pub async fn git_fetch(
    remote: String,
    state: State<'_, SharedState>,
) -> Result<RemoteOperationResult, String> {
    run_git_mutation(state.git_service.clone(), None, move |path, git| {
        fetch(&path, &git, &remote).map_err(|e| e.to_string())
    })
    .await
}

#[tauri::command]
pub async fn git_pull(
    remote: String,
    branch: String,
    state: State<'_, SharedState>,
) -> Result<RemoteOperationResult, String> {
    run_git_mutation(state.git_service.clone(), None, move |path, git| {
        pull(&path, &git, &remote, &branch).map_err(|e| e.to_string())
    })
    .await
}

#[tauri::command]
pub async fn git_push(
    remote: String,
    branch: String,
    state: State<'_, SharedState>,
) -> Result<RemoteOperationResult, String> {
    run_git_mutation(state.git_service.clone(), None, move |path, git| {
        push(&path, &git, &remote, &branch).map_err(|e| e.to_string())
    })
    .await
}
