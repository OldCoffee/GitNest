use rebased_core::{StashEntry, WorktreeEntry};
use tauri::State;

use super::blocking::{run_git_mutation, run_git_read};
use super::repo_path::{optional_repo_path, repo_handle};
use crate::state::SharedState;

#[tauri::command]
pub async fn list_stashes(
    repo_path: Option<String>,
    state: State<'_, SharedState>,
) -> Result<Vec<StashEntry>, String> {
    let handle = repo_handle(repo_path, &state)?;
    run_git_read(handle, |path, git| {
        rebased_core::list_stashes(&path, &git).map_err(|e| e.to_string())
    })
    .await
}

#[tauri::command]
pub async fn stash_push(
    message: Option<String>,
    repo_path: Option<String>,
    state: State<'_, SharedState>,
) -> Result<(), String> {
    run_git_mutation(
        state.git_service.clone(),
        optional_repo_path(repo_path),
        move |path, git| {
            rebased_core::stash_push(&path, &git, message.as_deref()).map_err(|e| e.to_string())
        },
    )
    .await
}

#[tauri::command]
pub async fn stash_pop(
    index: u32,
    repo_path: Option<String>,
    state: State<'_, SharedState>,
) -> Result<(), String> {
    run_git_mutation(
        state.git_service.clone(),
        optional_repo_path(repo_path),
        move |path, git| {
            rebased_core::stash_pop(&path, &git, index).map_err(|e| e.to_string())
        },
    )
    .await
}

#[tauri::command]
pub async fn stash_apply(
    index: u32,
    repo_path: Option<String>,
    state: State<'_, SharedState>,
) -> Result<(), String> {
    run_git_mutation(
        state.git_service.clone(),
        optional_repo_path(repo_path),
        move |path, git| {
            rebased_core::stash_apply(&path, &git, index).map_err(|e| e.to_string())
        },
    )
    .await
}

#[tauri::command]
pub async fn stash_drop(
    index: u32,
    repo_path: Option<String>,
    state: State<'_, SharedState>,
) -> Result<(), String> {
    run_git_mutation(
        state.git_service.clone(),
        optional_repo_path(repo_path),
        move |path, git| {
            rebased_core::stash_drop(&path, &git, index).map_err(|e| e.to_string())
        },
    )
    .await
}

#[tauri::command]
pub async fn list_worktrees(
    repo_path: Option<String>,
    state: State<'_, SharedState>,
) -> Result<Vec<WorktreeEntry>, String> {
    let handle = repo_handle(repo_path, &state)?;
    run_git_read(handle, |path, git| {
        rebased_core::list_worktrees(&path, &git).map_err(|e| e.to_string())
    })
    .await
}

#[tauri::command]
pub async fn add_worktree(
    path: String,
    branch: Option<String>,
    repo_path: Option<String>,
    state: State<'_, SharedState>,
) -> Result<(), String> {
    run_git_mutation(
        state.git_service.clone(),
        optional_repo_path(repo_path),
        move |repo_path, git| {
            rebased_core::add_worktree(&repo_path, &git, &path, branch.as_deref())
                .map_err(|e| e.to_string())
        },
    )
    .await
}

#[tauri::command]
pub async fn remove_worktree(
    path: String,
    force: bool,
    repo_path: Option<String>,
    state: State<'_, SharedState>,
) -> Result<(), String> {
    run_git_mutation(
        state.git_service.clone(),
        optional_repo_path(repo_path),
        move |repo_path, git| {
            rebased_core::remove_worktree(&repo_path, &git, &path, force).map_err(|e| e.to_string())
        },
    )
    .await
}
