use rebased_core::{StashEntry, WorktreeEntry};
use tauri::State;

use crate::state::SharedState;

#[tauri::command]
pub fn list_stashes(state: State<'_, SharedState>) -> Result<Vec<StashEntry>, String> {
    state.with_repo(|repo| rebased_core::list_stashes(repo.path(), repo.git()))
}

#[tauri::command]
pub fn stash_push(message: Option<String>, state: State<'_, SharedState>) -> Result<(), String> {
    state.with_repo(|repo| rebased_core::stash_push(repo.path(), repo.git(), message.as_deref()))
}

#[tauri::command]
pub fn stash_pop(index: u32, state: State<'_, SharedState>) -> Result<(), String> {
    state.with_repo(|repo| rebased_core::stash_pop(repo.path(), repo.git(), index))
}

#[tauri::command]
pub fn stash_apply(index: u32, state: State<'_, SharedState>) -> Result<(), String> {
    state.with_repo(|repo| rebased_core::stash_apply(repo.path(), repo.git(), index))
}

#[tauri::command]
pub fn stash_drop(index: u32, state: State<'_, SharedState>) -> Result<(), String> {
    state.with_repo(|repo| rebased_core::stash_drop(repo.path(), repo.git(), index))
}

#[tauri::command]
pub fn list_worktrees(state: State<'_, SharedState>) -> Result<Vec<WorktreeEntry>, String> {
    state.with_repo(|repo| rebased_core::list_worktrees(repo.path(), repo.git()))
}

#[tauri::command]
pub fn add_worktree(
    path: String,
    branch: Option<String>,
    state: State<'_, SharedState>,
) -> Result<(), String> {
    state.with_repo(|repo| {
        rebased_core::add_worktree(repo.path(), repo.git(), &path, branch.as_deref())
    })
}

#[tauri::command]
pub fn remove_worktree(
    path: String,
    force: bool,
    state: State<'_, SharedState>,
) -> Result<(), String> {
    state.with_repo(|repo| rebased_core::remove_worktree(repo.path(), repo.git(), &path, force))
}
