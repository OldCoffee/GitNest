use rebased_core::{
    checkout_ours, checkout_theirs, CommitOptions, StatusSnapshot,
};
use tauri::State;

use crate::state::SharedState;

#[tauri::command]
pub fn get_status(state: State<'_, SharedState>) -> Result<StatusSnapshot, String> {
    state.with_repo(|repo| rebased_core::status(repo.path(), repo.git()))
}

#[tauri::command]
pub fn stage_files(paths: Vec<String>, state: State<'_, SharedState>) -> Result<(), String> {
    state.with_repo(|repo| rebased_core::stage(repo.path(), repo.git(), &paths))
}

#[tauri::command]
pub fn unstage_files(paths: Vec<String>, state: State<'_, SharedState>) -> Result<(), String> {
    state.with_repo(|repo| rebased_core::unstage(repo.path(), repo.git(), &paths))
}

#[tauri::command]
pub fn stage_all_files(state: State<'_, SharedState>) -> Result<(), String> {
    state.with_repo(|repo| rebased_core::stage_all(repo.path(), repo.git()))
}

#[tauri::command]
pub fn unstage_all_files(state: State<'_, SharedState>) -> Result<(), String> {
    state.with_repo(|repo| rebased_core::unstage_all(repo.path(), repo.git()))
}

#[tauri::command]
pub fn commit_changes(
    options: CommitOptions,
    state: State<'_, SharedState>,
) -> Result<String, String> {
    state.with_repo(|repo| rebased_core::commit(repo.path(), repo.git(), &options))
}

#[tauri::command]
pub fn discard_changes(paths: Vec<String>, state: State<'_, SharedState>) -> Result<(), String> {
    state.with_repo(|repo| rebased_core::discard(repo.path(), repo.git(), &paths))
}

#[tauri::command]
pub fn resolve_conflict_ours(path: String, state: State<'_, SharedState>) -> Result<(), String> {
    state.with_repo(|repo| checkout_ours(repo.path(), repo.git(), &path))
}

#[tauri::command]
pub fn resolve_conflict_theirs(path: String, state: State<'_, SharedState>) -> Result<(), String> {
    state.with_repo(|repo| checkout_theirs(repo.path(), repo.git(), &path))
}
