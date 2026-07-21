use rebased_core::{
    diff_against_branch, diff_against_branch_files, diff_branch_files, diff_branch_range,
    diff_commit_files, diff_commits, diff_staged, diff_working, FileDiff,
};
use tauri::State;

use super::blocking::run_git_read;
use crate::state::SharedState;

#[tauri::command]
pub async fn get_diff_working(
    path: String,
    state: State<'_, SharedState>,
) -> Result<FileDiff, String> {
    run_git_read(state.git_service.handle()?, move |repo_path, git| {
        diff_working(&repo_path, &git, &path).map_err(|e| e.to_string())
    })
    .await
}

#[tauri::command]
pub async fn get_diff_staged(
    path: String,
    state: State<'_, SharedState>,
) -> Result<FileDiff, String> {
    run_git_read(state.git_service.handle()?, move |repo_path, git| {
        diff_staged(&repo_path, &git, &path).map_err(|e| e.to_string())
    })
    .await
}

#[tauri::command]
pub async fn get_diff_commits(
    base: String,
    head: String,
    path: Option<String>,
    state: State<'_, SharedState>,
) -> Result<FileDiff, String> {
    run_git_read(state.git_service.handle()?, move |repo_path, git| {
        diff_commits(&repo_path, &git, &base, &head, path.as_deref()).map_err(|e| e.to_string())
    })
    .await
}

#[tauri::command]
pub async fn get_commit_changed_files(
    commit: String,
    state: State<'_, SharedState>,
) -> Result<Vec<String>, String> {
    run_git_read(state.git_service.handle()?, move |repo_path, git| {
        diff_commit_files(&repo_path, &git, &commit).map_err(|e| e.to_string())
    })
    .await
}

#[tauri::command]
pub async fn get_branch_diff_files(
    base: String,
    head: String,
    state: State<'_, SharedState>,
) -> Result<Vec<String>, String> {
    run_git_read(state.git_service.handle()?, move |repo_path, git| {
        diff_branch_files(&repo_path, &git, &base, &head).map_err(|e| e.to_string())
    })
    .await
}

#[tauri::command]
pub async fn get_diff_branch_range(
    base: String,
    head: String,
    path: String,
    state: State<'_, SharedState>,
) -> Result<FileDiff, String> {
    run_git_read(state.git_service.handle()?, move |repo_path, git| {
        diff_branch_range(&repo_path, &git, &base, &head, &path).map_err(|e| e.to_string())
    })
    .await
}

#[tauri::command]
pub async fn get_diff_branch_working(
    branch: String,
    path: String,
    state: State<'_, SharedState>,
) -> Result<FileDiff, String> {
    run_git_read(state.git_service.handle()?, move |repo_path, git| {
        diff_against_branch(&repo_path, &git, &branch, &path).map_err(|e| e.to_string())
    })
    .await
}

#[tauri::command]
pub async fn get_branch_working_diff_files(
    branch: String,
    state: State<'_, SharedState>,
) -> Result<Vec<String>, String> {
    run_git_read(state.git_service.handle()?, move |repo_path, git| {
        diff_against_branch_files(&repo_path, &git, &branch).map_err(|e| e.to_string())
    })
    .await
}
