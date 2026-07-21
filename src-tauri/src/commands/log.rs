use rebased_core::{
    branches_containing, log_authors, log_count, log_page, CommitEntry, LogFilters,
};
use tauri::State;

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
pub fn get_log(
    branch: Option<String>,
    skip: u32,
    limit: u32,
    author: Option<String>,
    since: Option<String>,
    path: Option<String>,
    state: State<'_, SharedState>,
) -> Result<Vec<CommitEntry>, String> {
    let filters = build_filters(author, since, path);
    state.with_repo(|repo| {
        log_page(
            repo.path(),
            repo.git(),
            branch.as_deref(),
            skip,
            limit,
            &filters,
        )
    })
}

#[tauri::command]
pub fn get_log_count(
    branch: Option<String>,
    author: Option<String>,
    since: Option<String>,
    path: Option<String>,
    state: State<'_, SharedState>,
) -> Result<u32, String> {
    let filters = build_filters(author, since, path);
    state.with_repo(|repo| log_count(repo.path(), repo.git(), branch.as_deref(), &filters))
}

#[tauri::command]
pub fn get_log_authors(
    branch: Option<String>,
    state: State<'_, SharedState>,
) -> Result<Vec<String>, String> {
    state.with_repo(|repo| log_authors(repo.path(), repo.git(), branch.as_deref()))
}

#[tauri::command]
pub fn get_branches_containing(
    hash: String,
    state: State<'_, SharedState>,
) -> Result<Vec<String>, String> {
    state.with_repo(|repo| branches_containing(repo.path(), repo.git(), &hash))
}
