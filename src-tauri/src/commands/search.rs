use std::path::PathBuf;

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

fn map_match_path(root: &PathBuf, primary: bool, relative: String) -> String {
    if primary {
        relative
    } else {
        root.join(relative)
            .to_string_lossy()
            .replace('\\', "/")
    }
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
    let mut roots = state.workspace.roots();
    if roots.is_empty() {
        roots.push(state.workspace.root()?);
    }
    let primary_root = roots.first().cloned();
    let regex = SearchService::compile(
        &query,
        case_sensitive.unwrap_or(false),
        use_regex.unwrap_or(false),
    )?;
    let scheduler = state.tasks.clone();
    let (task_id, canceled) = scheduler.start(format!("Search: {query}"));
    let file_names_only = file_names_only.unwrap_or(false);

    tauri::async_runtime::spawn_blocking(move || {
        let mut total = 0usize;
        let mut error = None;
        for root in roots {
            if crate::services::TaskScheduler::is_canceled(&canceled) {
                break;
            }
            let primary = primary_root
                .as_ref()
                .map(|primary| {
                    let a = primary.canonicalize().unwrap_or_else(|_| primary.clone());
                    let b = root.canonicalize().unwrap_or_else(|_| root.clone());
                    a == b
                })
                .unwrap_or(false);
            let root_for_map = root.clone();
            let result = SearchService::search(
                &root,
                &regex,
                file_names_only,
                &canceled,
                |matches| {
                    let mapped = matches
                        .into_iter()
                        .map(|mut item| {
                            item.path = map_match_path(&root_for_map, primary, item.path);
                            item
                        })
                        .collect::<Vec<_>>();
                    let _ = app.emit(
                        "search-results",
                        SearchBatch {
                            task_id,
                            matches: mapped,
                            done: false,
                            total: 0,
                            error: None,
                        },
                    );
                },
            );
            match result {
                Ok(count) => total += count,
                Err(err) => {
                    error = Some(err);
                    break;
                }
            }
        }
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
        scheduler.finish(
            task_id,
            match error {
                Some(err) => Err(err),
                None => Ok(()),
            },
        );
    });

    Ok(task_id)
}
