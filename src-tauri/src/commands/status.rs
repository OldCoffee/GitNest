use rebased_core::{
    checkout_ours, checkout_theirs, CommitOptions, CommitResult, DiffHunk, StatusSnapshot,
};
use tauri::State;

use super::blocking::{run_git_mutation, run_git_read};
use super::repo_path::{optional_repo_path, repo_handle};
use crate::state::SharedState;

#[tauri::command]
#[tracing::instrument(skip(state))]
pub async fn get_status(
    repo_path: Option<String>,
    state: State<'_, SharedState>,
) -> Result<StatusSnapshot, String> {
    let handle = repo_handle(repo_path, &state)?;
    run_git_read(handle, |path, git| {
        rebased_core::status(&path, &git).map_err(|error| error.to_string())
    })
    .await
}

#[tauri::command]
pub async fn stage_files(
    paths: Vec<String>,
    repo_path: Option<String>,
    state: State<'_, SharedState>,
) -> Result<(), String> {
    run_git_mutation(
        state.git_service.clone(),
        optional_repo_path(repo_path),
        move |path, git| rebased_core::stage(&path, &git, &paths).map_err(|error| error.to_string()),
    )
    .await
}

#[tauri::command]
pub async fn unstage_files(
    paths: Vec<String>,
    repo_path: Option<String>,
    state: State<'_, SharedState>,
) -> Result<(), String> {
    run_git_mutation(
        state.git_service.clone(),
        optional_repo_path(repo_path),
        move |path, git| {
            rebased_core::unstage(&path, &git, &paths).map_err(|error| error.to_string())
        },
    )
    .await
}

#[tauri::command]
pub async fn stage_all_files(
    repo_path: Option<String>,
    state: State<'_, SharedState>,
) -> Result<(), String> {
    run_git_mutation(
        state.git_service.clone(),
        optional_repo_path(repo_path),
        |path, git| rebased_core::stage_all(&path, &git).map_err(|error| error.to_string()),
    )
    .await
}

#[tauri::command]
pub async fn unstage_all_files(
    repo_path: Option<String>,
    state: State<'_, SharedState>,
) -> Result<(), String> {
    run_git_mutation(
        state.git_service.clone(),
        optional_repo_path(repo_path),
        |path, git| rebased_core::unstage_all(&path, &git).map_err(|error| error.to_string()),
    )
    .await
}

#[tauri::command]
pub async fn stage_hunk(
    path: String,
    hunk: DiffHunk,
    repo_path: Option<String>,
    state: State<'_, SharedState>,
) -> Result<(), String> {
    run_git_mutation(
        state.git_service.clone(),
        optional_repo_path(repo_path),
        move |repo, git| {
            rebased_core::stage_hunk(&repo, &git, &path, &hunk).map_err(|error| error.to_string())
        },
    )
    .await
}

#[tauri::command]
pub async fn unstage_hunk(
    path: String,
    hunk: DiffHunk,
    repo_path: Option<String>,
    state: State<'_, SharedState>,
) -> Result<(), String> {
    run_git_mutation(
        state.git_service.clone(),
        optional_repo_path(repo_path),
        move |repo, git| {
            rebased_core::unstage_hunk(&repo, &git, &path, &hunk).map_err(|error| error.to_string())
        },
    )
    .await
}

#[tauri::command]
pub async fn stage_lines(
    path: String,
    hunk: DiffHunk,
    selected_indices: Vec<usize>,
    repo_path: Option<String>,
    state: State<'_, SharedState>,
) -> Result<(), String> {
    run_git_mutation(
        state.git_service.clone(),
        optional_repo_path(repo_path),
        move |repo, git| {
            rebased_core::stage_lines(&repo, &git, &path, &hunk, &selected_indices)
                .map_err(|error| error.to_string())
        },
    )
    .await
}

#[tauri::command]
pub async fn unstage_lines(
    path: String,
    hunk: DiffHunk,
    selected_indices: Vec<usize>,
    repo_path: Option<String>,
    state: State<'_, SharedState>,
) -> Result<(), String> {
    run_git_mutation(
        state.git_service.clone(),
        optional_repo_path(repo_path),
        move |repo, git| {
            rebased_core::unstage_lines(&repo, &git, &path, &hunk, &selected_indices)
                .map_err(|error| error.to_string())
        },
    )
    .await
}

#[tauri::command]
pub async fn discard_hunk(
    path: String,
    hunk: DiffHunk,
    repo_path: Option<String>,
    state: State<'_, SharedState>,
) -> Result<(), String> {
    run_git_mutation(
        state.git_service.clone(),
        optional_repo_path(repo_path),
        move |repo, git| {
            rebased_core::discard_hunk(&repo, &git, &path, &hunk).map_err(|error| error.to_string())
        },
    )
    .await
}

#[tauri::command]
pub async fn discard_lines(
    path: String,
    hunk: DiffHunk,
    selected_indices: Vec<usize>,
    repo_path: Option<String>,
    state: State<'_, SharedState>,
) -> Result<(), String> {
    run_git_mutation(
        state.git_service.clone(),
        optional_repo_path(repo_path),
        move |repo, git| {
            rebased_core::discard_lines(&repo, &git, &path, &hunk, &selected_indices)
                .map_err(|error| error.to_string())
        },
    )
    .await
}

#[tauri::command]
pub async fn get_commit_template(
    repo_path: Option<String>,
    state: State<'_, SharedState>,
) -> Result<Option<String>, String> {
    let handle = repo_handle(repo_path, &state)?;
    run_git_read(handle, |path, git| {
        rebased_core::get_commit_template(&path, &git).map_err(|error| error.to_string())
    })
    .await
}

#[tauri::command]
pub async fn commit_changes(
    options: CommitOptions,
    repo_path: Option<String>,
    state: State<'_, SharedState>,
) -> Result<CommitResult, String> {
    run_git_mutation(
        state.git_service.clone(),
        optional_repo_path(repo_path),
        move |path, git| {
            rebased_core::commit(&path, &git, &options).map_err(|error| error.to_string())
        },
    )
    .await
}

#[tauri::command]
pub async fn discard_changes(
    paths: Vec<String>,
    repo_path: Option<String>,
    state: State<'_, SharedState>,
) -> Result<(), String> {
    run_git_mutation(
        state.git_service.clone(),
        optional_repo_path(repo_path),
        move |path, git| {
            rebased_core::discard(&path, &git, &paths).map_err(|error| error.to_string())
        },
    )
    .await
}

#[tauri::command]
pub async fn resolve_conflict_ours(
    path: String,
    state: State<'_, SharedState>,
) -> Result<(), String> {
    run_git_mutation(state.git_service.clone(), None, move |repo, git| {
        checkout_ours(&repo, &git, &path).map_err(|error| error.to_string())
    })
    .await
}

#[tauri::command]
pub async fn resolve_conflict_theirs(
    path: String,
    state: State<'_, SharedState>,
) -> Result<(), String> {
    run_git_mutation(state.git_service.clone(), None, move |repo, git| {
        checkout_theirs(&repo, &git, &path).map_err(|error| error.to_string())
    })
    .await
}
