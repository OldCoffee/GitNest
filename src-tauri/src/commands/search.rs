use serde::Serialize;
use tauri::{AppHandle, Emitter, State};

use crate::services::{SearchMatch, SearchService};
use crate::state::SharedState;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct SearchBatch {
    task_id: u64,
    matches: Vec<SearchMatch>,
    done: bool,
    total: usize,
    error: Option<String>,
}

#[tauri::command]
pub fn start_workspace_search(
    query: String,
    file_names_only: Option<bool>,
    case_sensitive: Option<bool>,
    use_regex: Option<bool>,
    app: AppHandle,
    state: State<'_, SharedState>,
) -> Result<u64, String> {
    if query.is_empty() {
        return Err("search query is empty".into());
    }
    let root = state.workspace.root()?;
    let regex = SearchService::compile(
        &query,
        case_sensitive.unwrap_or(false),
        use_regex.unwrap_or(false),
    )?;
    let scheduler = state.tasks.clone();
    let (task_id, canceled) = scheduler.start(format!("Search: {query}"));

    tauri::async_runtime::spawn_blocking(move || {
        let result = SearchService::search(
            &root,
            &regex,
            file_names_only.unwrap_or(false),
            &canceled,
            |matches| {
                let _ = app.emit(
                    "search-results",
                    SearchBatch {
                        task_id,
                        matches,
                        done: false,
                        total: 0,
                        error: None,
                    },
                );
            },
        );
        let (total, error) = match &result {
            Ok(total) => (*total, None),
            Err(error) => (0, Some(error.clone())),
        };
        let _ = app.emit(
            "search-results",
            SearchBatch {
                task_id,
                matches: Vec::new(),
                done: true,
                total,
                error: error.clone(),
            },
        );
        scheduler.finish(task_id, result.map(|_| ()));
    });

    Ok(task_id)
}
