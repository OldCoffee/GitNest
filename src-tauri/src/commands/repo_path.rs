use std::path::PathBuf;

use rebased_core::GitCli;

use crate::state::SharedState;

/// Normalize optional Tauri `repoPath` (trim; empty → None).
pub fn optional_repo_path(repo_path: Option<String>) -> Option<PathBuf> {
    repo_path
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(PathBuf::from)
}

/// Resolve a registered git handle: explicit path via `handle_for`, else active.
pub fn repo_handle(
    repo_path: Option<String>,
    state: &SharedState,
) -> Result<(PathBuf, GitCli), String> {
    match optional_repo_path(repo_path) {
        Some(path) => state.git_service.handle_for(path.as_path()),
        None => state.git_service.handle(),
    }
}
