use rebased_core::{file_preview, FilePreview, PreviewMode};
use tauri::State;

use crate::state::SharedState;

#[tauri::command]
pub fn get_file_preview(
    path: String,
    mode: String,
    commit_hash: Option<String>,
    state: State<'_, SharedState>,
) -> Result<FilePreview, String> {
    let preview_mode = match mode.as_str() {
        "working" => PreviewMode::Working,
        "staged" => PreviewMode::Staged,
        "commit" => PreviewMode::Commit,
        _ => return Err(format!("invalid preview mode: {mode}")),
    };
    state
        .with_repo(|repo| {
            file_preview(
                repo.path(),
                repo.git(),
                &path,
                preview_mode,
                commit_hash.as_deref(),
            )
        })
        .map_err(|e| e.to_string())
}
