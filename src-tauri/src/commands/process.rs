use std::sync::Arc;

use tauri::State;

use crate::process_stats::{AppProcessStats, SharedProcessStatsTracker};

/// Snapshot is expensive (full process table refresh). Run off the IPC thread.
#[tauri::command]
pub async fn get_app_process_stats(
    tracker: State<'_, SharedProcessStatsTracker>,
) -> Result<AppProcessStats, String> {
    let tracker = Arc::clone(&tracker);
    tauri::async_runtime::spawn_blocking(move || Ok(tracker.lock().snapshot()))
        .await
        .map_err(|error| error.to_string())?
}
