mod asset_scope;
mod commands;
mod logging;
mod process_stats;
mod services;
mod state;
mod watcher;

use std::sync::Arc;

use process_stats::ProcessStatsTracker;
use rebased_core::AppSettings;
use state::AppState;
use tauri::Manager;
use tauri_plugin_store::StoreExt;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            match app.path().app_log_dir() {
                Ok(dir) => {
                    if let Err(error) = logging::init(dir) {
                        eprintln!("failed to init file logging: {error}");
                    }
                }
                Err(error) => eprintln!("failed to resolve app log dir: {error}"),
            }

            let settings = load_settings(app.handle());
            let shared = Arc::new(AppState::new(settings));
            watcher::start_repo_watcher(app.handle().clone(), shared.clone());
            app.manage(shared);
            app.manage(Arc::new(
                parking_lot::Mutex::new(ProcessStatsTracker::new()),
            ));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::open_repository,
            commands::is_git_repository,
            commands::init_git_repository,
            commands::get_repo_info,
            commands::close_repository,
            commands::open_new_window,
            commands::project_has_java_markers,
            commands::get_status,
            commands::stage_files,
            commands::unstage_files,
            commands::stage_all_files,
            commands::unstage_all_files,
            commands::stage_hunk,
            commands::unstage_hunk,
            commands::commit_changes,
            commands::discard_changes,
            commands::resolve_conflict_ours,
            commands::resolve_conflict_theirs,
            commands::get_diff_working,
            commands::get_diff_staged,
            commands::get_diff_commits,
            commands::get_commit_changed_files,
            commands::get_branch_diff_files,
            commands::get_diff_branch_range,
            commands::get_diff_branch_working,
            commands::get_branch_working_diff_files,
            commands::get_file_preview,
            commands::get_log,
            commands::get_log_count,
            commands::get_log_authors,
            commands::get_branches_containing,
            commands::get_branches,
            commands::checkout_branch,
            commands::create_new_branch,
            commands::create_branch_from,
            commands::rename_branch,
            commands::checkout_and_rebase_onto,
            commands::rebase_current_onto,
            commands::merge_branch_into_current,
            commands::update_local_branch,
            commands::pull_remote_into_branch,
            commands::delete_existing_branch,
            commands::delete_remote_branch_ref,
            commands::get_remotes,
            commands::git_fetch,
            commands::git_pull,
            commands::git_push,
            commands::get_settings,
            commands::save_settings,
            commands::get_recent_repos,
            commands::clear_recent_repos,
            commands::get_repo_operation_state,
            commands::git_merge,
            commands::git_merge_abort,
            commands::git_rebase,
            commands::git_rebase_continue,
            commands::git_rebase_skip,
            commands::git_rebase_abort,
            commands::git_reset,
            commands::git_revert,
            commands::git_cherry_pick,
            commands::git_cherry_pick_abort,
            commands::list_stashes,
            commands::stash_push,
            commands::stash_pop,
            commands::stash_apply,
            commands::stash_drop,
            commands::list_worktrees,
            commands::add_worktree,
            commands::remove_worktree,
            commands::git_clone,
            commands::cancel_clone,
            commands::git_add_remote,
            commands::git_remove_remote,
            commands::git_set_remote_url,
            commands::git_create_tag,
            commands::git_delete_tag,
            commands::terminal_run,
            commands::terminal_create,
            commands::terminal_write,
            commands::terminal_resize,
            commands::terminal_close,
            commands::terminal_close_all,
            commands::list_project_entries,
            commands::list_project_tree,
            commands::create_project_file,
            commands::create_project_directory,
            commands::rename_project_entry,
            commands::move_project_entry,
            commands::copy_project_entry,
            commands::delete_project_entry,
            commands::read_text_file,
            commands::read_absolute_text_file,
            commands::write_text_file,
            commands::get_project_absolute_path,
            commands::add_to_gitignore,
            commands::import_external_entries,
            commands::get_clipboard_file_paths,
            commands::get_app_process_stats,
            commands::get_perf_probe_config,
            commands::get_desktop_smoke_config,
            commands::write_perf_report,
            commands::write_smoke_report,
            commands::export_diagnostics,
            commands::list_tasks,
            commands::cancel_task,
            commands::start_workspace_search,
            commands::java_lsp_status,
            commands::detect_java_runtime,
            commands::detect_maven_runtime,
            commands::detect_jdt_ls,
            commands::java_lsp_start,
            commands::decompile_class_file,
            commands::lsp_send,
            commands::lsp_stop,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn load_settings(app: &tauri::AppHandle) -> AppSettings {
    app.store("settings.json")
        .ok()
        .and_then(|store| store.get("settings"))
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default()
}
