use rebased_core::{
    cherry_pick, cherry_pick_abort, merge_abort, merge_branch, rebase_abort, rebase_branch,
    rebase_continue, rebase_skip, repo_operation_state, reset, revert_commit,
    RemoteOperationResult, RepoOperationState,
};
use tauri::State;

use super::blocking::{run_git_mutation, run_git_read};
use crate::state::SharedState;

#[tauri::command]
pub async fn get_repo_operation_state(
    state: State<'_, SharedState>,
) -> Result<RepoOperationState, String> {
    run_git_read(state.git_service.handle()?, |path, git| {
        Ok(repo_operation_state(&path, &git))
    })
    .await
}

#[tauri::command]
pub async fn git_merge(
    branch: String,
    state: State<'_, SharedState>,
) -> Result<RemoteOperationResult, String> {
    run_git_mutation(state.git_service.clone(), move |path, git| {
        merge_branch(&path, &git, &branch).map_err(|e| e.to_string())
    })
    .await
}

#[tauri::command]
pub async fn git_merge_abort(
    state: State<'_, SharedState>,
) -> Result<RemoteOperationResult, String> {
    run_git_mutation(state.git_service.clone(), |path, git| {
        merge_abort(&path, &git).map_err(|e| e.to_string())
    })
    .await
}

#[tauri::command]
pub async fn git_rebase(
    branch: String,
    state: State<'_, SharedState>,
) -> Result<RemoteOperationResult, String> {
    run_git_mutation(state.git_service.clone(), move |path, git| {
        rebase_branch(&path, &git, &branch).map_err(|e| e.to_string())
    })
    .await
}

#[tauri::command]
pub async fn git_rebase_continue(
    state: State<'_, SharedState>,
) -> Result<RemoteOperationResult, String> {
    run_git_mutation(state.git_service.clone(), |path, git| {
        rebase_continue(&path, &git).map_err(|e| e.to_string())
    })
    .await
}

#[tauri::command]
pub async fn git_rebase_skip(
    state: State<'_, SharedState>,
) -> Result<RemoteOperationResult, String> {
    run_git_mutation(state.git_service.clone(), |path, git| {
        rebase_skip(&path, &git).map_err(|e| e.to_string())
    })
    .await
}

#[tauri::command]
pub async fn git_rebase_abort(
    state: State<'_, SharedState>,
) -> Result<RemoteOperationResult, String> {
    run_git_mutation(state.git_service.clone(), |path, git| {
        rebase_abort(&path, &git).map_err(|e| e.to_string())
    })
    .await
}

#[tauri::command]
pub async fn git_reset(
    mode: String,
    target: String,
    state: State<'_, SharedState>,
) -> Result<RemoteOperationResult, String> {
    run_git_mutation(state.git_service.clone(), move |path, git| {
        reset(&path, &git, &mode, &target).map_err(|e| e.to_string())
    })
    .await
}

#[tauri::command]
pub async fn git_revert(
    commit: String,
    state: State<'_, SharedState>,
) -> Result<RemoteOperationResult, String> {
    run_git_mutation(state.git_service.clone(), move |path, git| {
        revert_commit(&path, &git, &commit).map_err(|e| e.to_string())
    })
    .await
}

#[tauri::command]
pub async fn git_cherry_pick(
    commit: String,
    state: State<'_, SharedState>,
) -> Result<RemoteOperationResult, String> {
    run_git_mutation(state.git_service.clone(), move |path, git| {
        cherry_pick(&path, &git, &commit).map_err(|e| e.to_string())
    })
    .await
}

#[tauri::command]
pub async fn git_cherry_pick_abort(
    state: State<'_, SharedState>,
) -> Result<RemoteOperationResult, String> {
    run_git_mutation(state.git_service.clone(), |path, git| {
        cherry_pick_abort(&path, &git).map_err(|e| e.to_string())
    })
    .await
}
