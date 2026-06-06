use tauri::State;

use crate::process_stats::{AppProcessStats, SharedProcessStatsTracker};

#[tauri::command]
pub fn get_app_process_stats(
    tracker: State<'_, SharedProcessStatsTracker>,
) -> Result<AppProcessStats, String> {
    Ok(tracker.lock().snapshot())
}
