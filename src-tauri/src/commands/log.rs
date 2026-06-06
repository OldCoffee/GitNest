use rebased_core::{log_count, log_page, CommitEntry};
use tauri::State;

use crate::state::SharedState;

#[tauri::command]
pub fn get_log(
    branch: Option<String>,
    skip: u32,
    limit: u32,
    state: State<'_, SharedState>,
) -> Result<Vec<CommitEntry>, String> {
    state.with_repo(|repo| {
        log_page(
            repo.path(),
            repo.git(),
            branch.as_deref(),
            skip,
            limit,
        )
    })
}

#[tauri::command]
pub fn get_log_count(branch: Option<String>, state: State<'_, SharedState>) -> Result<u32, String> {
    state.with_repo(|repo| log_count(repo.path(), repo.git(), branch.as_deref()))
}
