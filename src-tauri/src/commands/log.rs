use rebased_core::{
    branches_containing, log_authors, log_count, log_page, CommitEntry, LogFilters,
};
use tauri::State;

use super::blocking::run_git_read;
use super::repo_path::repo_handle;
use crate::state::SharedState;

fn build_filters(
    author: Option<String>,
    since: Option<String>,
    path: Option<String>,
) -> LogFilters {
    LogFilters {
        author: author.filter(|s| !s.is_empty()),
        since: since.filter(|s| !s.is_empty()),
        path: path.filter(|s| !s.is_empty()),
    }
}

#[tauri::command]
#[tracing::instrument(skip(state, author, since, path), fields(skip, limit))]
pub async fn get_log(
    branch: Option<String>,
    skip: u32,
    limit: u32,
    author: Option<String>,
    since: Option<String>,
    path: Option<String>,
    repo_path: Option<String>,
    state: State<'_, SharedState>,
) -> Result<Vec<CommitEntry>, String> {
    let filters = build_filters(author, since, path);
    let handle = repo_handle(repo_path, &state)?;
    run_git_read(handle, move |repo_path, git| {
        log_page(&repo_path, &git, branch.as_deref(), skip, limit, &filters)
            .map_err(|e| e.to_string())
    })
    .await
}

#[tauri::command]
pub async fn get_log_count(
    branch: Option<String>,
    author: Option<String>,
    since: Option<String>,
    path: Option<String>,
    repo_path: Option<String>,
    state: State<'_, SharedState>,
) -> Result<u32, String> {
    let filters = build_filters(author, since, path);
    let handle = repo_handle(repo_path, &state)?;
    run_git_read(handle, move |repo_path, git| {
        log_count(&repo_path, &git, branch.as_deref(), &filters).map_err(|e| e.to_string())
    })
    .await
}

#[tauri::command]
pub async fn get_log_authors(
    branch: Option<String>,
    repo_path: Option<String>,
    state: State<'_, SharedState>,
) -> Result<Vec<String>, String> {
    let handle = repo_handle(repo_path, &state)?;
    run_git_read(handle, move |repo_path, git| {
        log_authors(&repo_path, &git, branch.as_deref()).map_err(|e| e.to_string())
    })
    .await
}

#[tauri::command]
pub async fn get_branches_containing(
    hash: String,
    repo_path: Option<String>,
    state: State<'_, SharedState>,
) -> Result<Vec<String>, String> {
    let handle = repo_handle(repo_path, &state)?;
    run_git_read(handle, move |repo_path, git| {
        branches_containing(&repo_path, &git, &hash).map_err(|e| e.to_string())
    })
    .await
}
