use rebased_core::{
    cherry_pick, cherry_pick_abort, merge_abort, merge_branch, rebase_abort, rebase_branch,
    rebase_continue, rebase_skip, repo_operation_state, reset, revert_commit, RepoOperationState,
    RemoteOperationResult,
};
use tauri::State;

use crate::state::SharedState;

#[tauri::command]
pub fn get_repo_operation_state(
    state: State<'_, SharedState>,
) -> Result<RepoOperationState, String> {
    state.with_repo(|repo| Ok(repo_operation_state(repo.path(), repo.git())))
}

#[tauri::command]
pub fn git_merge(branch: String, state: State<'_, SharedState>) -> Result<RemoteOperationResult, String> {
    state.with_repo(|repo| merge_branch(repo.path(), repo.git(), &branch))
}

#[tauri::command]
pub fn git_merge_abort(state: State<'_, SharedState>) -> Result<RemoteOperationResult, String> {
    state.with_repo(|repo| merge_abort(repo.path(), repo.git()))
}

#[tauri::command]
pub fn git_rebase(branch: String, state: State<'_, SharedState>) -> Result<RemoteOperationResult, String> {
    state.with_repo(|repo| rebase_branch(repo.path(), repo.git(), &branch))
}

#[tauri::command]
pub fn git_rebase_continue(state: State<'_, SharedState>) -> Result<RemoteOperationResult, String> {
    state.with_repo(|repo| rebase_continue(repo.path(), repo.git()))
}

#[tauri::command]
pub fn git_rebase_skip(state: State<'_, SharedState>) -> Result<RemoteOperationResult, String> {
    state.with_repo(|repo| rebase_skip(repo.path(), repo.git()))
}

#[tauri::command]
pub fn git_rebase_abort(state: State<'_, SharedState>) -> Result<RemoteOperationResult, String> {
    state.with_repo(|repo| rebase_abort(repo.path(), repo.git()))
}

#[tauri::command]
pub fn git_reset(
    mode: String,
    target: String,
    state: State<'_, SharedState>,
) -> Result<RemoteOperationResult, String> {
    state.with_repo(|repo| reset(repo.path(), repo.git(), &mode, &target))
}

#[tauri::command]
pub fn git_revert(
    commit: String,
    state: State<'_, SharedState>,
) -> Result<RemoteOperationResult, String> {
    state.with_repo(|repo| revert_commit(repo.path(), repo.git(), &commit))
}

#[tauri::command]
pub fn git_cherry_pick(
    commit: String,
    state: State<'_, SharedState>,
) -> Result<RemoteOperationResult, String> {
    state.with_repo(|repo| cherry_pick(repo.path(), repo.git(), &commit))
}

#[tauri::command]
pub fn git_cherry_pick_abort(
    state: State<'_, SharedState>,
) -> Result<RemoteOperationResult, String> {
    state.with_repo(|repo| cherry_pick_abort(repo.path(), repo.git()))
}
