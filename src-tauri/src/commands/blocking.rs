use std::path::PathBuf;

use rebased_core::GitCli;

use crate::services::GitService;

pub async fn run_git_read<T, F>(handle: (PathBuf, GitCli), operation: F) -> Result<T, String>
where
    T: Send + 'static,
    F: FnOnce(PathBuf, GitCli) -> Result<T, String> + Send + 'static,
{
    tauri::async_runtime::spawn_blocking(move || operation(handle.0, handle.1))
        .await
        .map_err(|error| error.to_string())?
}

pub async fn run_git_mutation<T, F>(
    service: std::sync::Arc<GitService>,
    operation: F,
) -> Result<T, String>
where
    T: Send + 'static,
    F: FnOnce(PathBuf, GitCli) -> Result<T, String> + Send + 'static,
{
    tauri::async_runtime::spawn_blocking(move || service.with_mutation(operation))
        .await
        .map_err(|error| error.to_string())?
}
