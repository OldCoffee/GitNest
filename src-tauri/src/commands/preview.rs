use rebased_core::{file_preview, FilePreview, PreviewMode};
use tauri::State;

use super::blocking::run_git_read;
use super::repo_path::repo_handle;
use crate::state::SharedState;

#[tauri::command]
pub async fn get_file_preview(
    path: String,
    mode: String,
    commit_hash: Option<String>,
    repo_path: Option<String>,
    state: State<'_, SharedState>,
) -> Result<FilePreview, String> {
    let preview_mode = match mode.as_str() {
        "working" => PreviewMode::Working,
        "staged" => PreviewMode::Staged,
        "commit" => PreviewMode::Commit,
        _ => return Err(format!("invalid preview mode: {mode}")),
    };
    let handle = repo_handle(repo_path, &state)?;
    run_git_read(handle, move |repo_path, git| {
        file_preview(
            &repo_path,
            &git,
            &path,
            preview_mode,
            commit_hash.as_deref(),
        )
        .map_err(|e| e.to_string())
    })
    .await
}
