use rebased_core::{
    diff_against_branch, diff_against_branch_files, diff_branch_files, diff_branch_range,
    diff_commit_files, diff_commits, diff_staged, diff_working, FileDiff,
};
use tauri::State;

use crate::state::SharedState;

#[tauri::command]
pub fn get_diff_working(path: String, state: State<'_, SharedState>) -> Result<FileDiff, String> {
    state.with_repo(|repo| diff_working(repo.path(), repo.git(), &path))
}

#[tauri::command]
pub fn get_diff_staged(path: String, state: State<'_, SharedState>) -> Result<FileDiff, String> {
    state.with_repo(|repo| diff_staged(repo.path(), repo.git(), &path))
}

#[tauri::command]
pub fn get_diff_commits(
    base: String,
    head: String,
    path: Option<String>,
    state: State<'_, SharedState>,
) -> Result<FileDiff, String> {
    state.with_repo(|repo| diff_commits(repo.path(), repo.git(), &base, &head, path.as_deref()))
}

#[tauri::command]
pub fn get_commit_changed_files(
    commit: String,
    state: State<'_, SharedState>,
) -> Result<Vec<String>, String> {
    state.with_repo(|repo| diff_commit_files(repo.path(), repo.git(), &commit))
}

#[tauri::command]
pub fn get_branch_diff_files(
    base: String,
    head: String,
    state: State<'_, SharedState>,
) -> Result<Vec<String>, String> {
    state.with_repo(|repo| diff_branch_files(repo.path(), repo.git(), &base, &head))
}

#[tauri::command]
pub fn get_diff_branch_range(
    base: String,
    head: String,
    path: String,
    state: State<'_, SharedState>,
) -> Result<FileDiff, String> {
    state.with_repo(|repo| diff_branch_range(repo.path(), repo.git(), &base, &head, &path))
}

#[tauri::command]
pub fn get_diff_branch_working(
    branch: String,
    path: String,
    state: State<'_, SharedState>,
) -> Result<FileDiff, String> {
    state.with_repo(|repo| diff_against_branch(repo.path(), repo.git(), &branch, &path))
}

#[tauri::command]
pub fn get_branch_working_diff_files(
    branch: String,
    state: State<'_, SharedState>,
) -> Result<Vec<String>, String> {
    state.with_repo(|repo| diff_against_branch_files(repo.path(), repo.git(), &branch))
}
