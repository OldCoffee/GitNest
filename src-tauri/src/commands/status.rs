use rebased_core::{checkout_ours, checkout_theirs, CommitOptions, StatusSnapshot};
use tauri::State;

use super::blocking::{run_git_mutation, run_git_read};
use crate::state::SharedState;

#[tauri::command]
#[tracing::instrument(skip(state))]
pub async fn get_status(state: State<'_, SharedState>) -> Result<StatusSnapshot, String> {
    run_git_read(state.git_service.handle()?, |path, git| {
        rebased_core::status(&path, &git).map_err(|error| error.to_string())
    })
    .await
}

#[tauri::command]
pub async fn stage_files(paths: Vec<String>, state: State<'_, SharedState>) -> Result<(), String> {
    run_git_mutation(state.git_service.clone(), move |path, git| {
        rebased_core::stage(&path, &git, &paths).map_err(|error| error.to_string())
    })
    .await
}

#[tauri::command]
pub async fn unstage_files(
    paths: Vec<String>,
    state: State<'_, SharedState>,
) -> Result<(), String> {
    run_git_mutation(state.git_service.clone(), move |path, git| {
        rebased_core::unstage(&path, &git, &paths).map_err(|error| error.to_string())
    })
    .await
}

#[tauri::command]
pub async fn stage_all_files(state: State<'_, SharedState>) -> Result<(), String> {
    run_git_mutation(state.git_service.clone(), |path, git| {
        rebased_core::stage_all(&path, &git).map_err(|error| error.to_string())
    })
    .await
}

#[tauri::command]
pub async fn unstage_all_files(state: State<'_, SharedState>) -> Result<(), String> {
    run_git_mutation(state.git_service.clone(), |path, git| {
        rebased_core::unstage_all(&path, &git).map_err(|error| error.to_string())
    })
    .await
}

#[tauri::command]
pub async fn commit_changes(
    options: CommitOptions,
    state: State<'_, SharedState>,
) -> Result<String, String> {
    run_git_mutation(state.git_service.clone(), move |path, git| {
        rebased_core::commit(&path, &git, &options).map_err(|error| error.to_string())
    })
    .await
}

#[tauri::command]
pub async fn discard_changes(
    paths: Vec<String>,
    state: State<'_, SharedState>,
) -> Result<(), String> {
    run_git_mutation(state.git_service.clone(), move |path, git| {
        rebased_core::discard(&path, &git, &paths).map_err(|error| error.to_string())
    })
    .await
}

#[tauri::command]
pub async fn resolve_conflict_ours(
    path: String,
    state: State<'_, SharedState>,
) -> Result<(), String> {
    run_git_mutation(state.git_service.clone(), move |repo, git| {
        checkout_ours(&repo, &git, &path).map_err(|error| error.to_string())
    })
    .await
}

#[tauri::command]
pub async fn resolve_conflict_theirs(
    path: String,
    state: State<'_, SharedState>,
) -> Result<(), String> {
    run_git_mutation(state.git_service.clone(), move |repo, git| {
        checkout_theirs(&repo, &git, &path).map_err(|error| error.to_string())
    })
    .await
}
