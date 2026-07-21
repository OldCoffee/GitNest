use tauri::State;

use crate::services::TaskInfo;
use crate::state::SharedState;

#[tauri::command]
pub fn list_tasks(state: State<'_, SharedState>) -> Vec<TaskInfo> {
    state.tasks.snapshot()
}

#[tauri::command]
pub fn cancel_task(id: u64, state: State<'_, SharedState>) -> bool {
    state.tasks.cancel(id)
}
