use rebased_core::{
    checkout, checkout_and_rebase, create_branch, create_branch_from as core_create_branch_from,
    delete_branch, delete_remote_branch, list_branches, merge_branch_into, pull_remote_into,
    rebase_branch_onto, rename_branch as core_rename_branch, update_branch, BranchInfo,
};
use tauri::State;

use super::blocking::{run_git_mutation, run_git_read};
use crate::state::SharedState;

#[tauri::command]
pub async fn get_branches(state: State<'_, SharedState>) -> Result<Vec<BranchInfo>, String> {
    run_git_read(state.git_service.handle()?, |path, git| {
        list_branches(&path, &git).map_err(|e| e.to_string())
    })
    .await
}

#[tauri::command]
pub async fn checkout_branch(name: String, state: State<'_, SharedState>) -> Result<(), String> {
    run_git_mutation(state.git_service.clone(), None, move |path, git| {
        checkout(&path, &git, &name).map_err(|e| e.to_string())
    })
    .await
}

#[tauri::command]
pub async fn create_new_branch(name: String, state: State<'_, SharedState>) -> Result<(), String> {
    run_git_mutation(state.git_service.clone(), None, move |path, git| {
        create_branch(&path, &git, &name).map_err(|e| e.to_string())
    })
    .await
}

#[tauri::command]
pub async fn create_branch_from(
    name: String,
    start_point: String,
    state: State<'_, SharedState>,
) -> Result<(), String> {
    run_git_mutation(state.git_service.clone(), None, move |path, git| {
        core_create_branch_from(&path, &git, &name, &start_point).map_err(|e| e.to_string())
    })
    .await
}

#[tauri::command]
pub async fn rename_branch(
    old_name: String,
    new_name: String,
    state: State<'_, SharedState>,
) -> Result<(), String> {
    run_git_mutation(state.git_service.clone(), None, move |path, git| {
        core_rename_branch(&path, &git, &old_name, &new_name).map_err(|e| e.to_string())
    })
    .await
}

#[tauri::command]
pub async fn checkout_and_rebase_onto(
    branch: String,
    onto: String,
    state: State<'_, SharedState>,
) -> Result<(), String> {
    run_git_mutation(state.git_service.clone(), None, move |path, git| {
        checkout_and_rebase(&path, &git, &branch, &onto).map_err(|e| e.to_string())
    })
    .await
}

#[tauri::command]
pub async fn rebase_current_onto(
    base_branch: String,
    onto_branch: String,
    state: State<'_, SharedState>,
) -> Result<(), String> {
    run_git_mutation(state.git_service.clone(), None, move |path, git| {
        rebase_branch_onto(&path, &git, &base_branch, &onto_branch).map_err(|e| e.to_string())
    })
    .await
}

#[tauri::command]
pub async fn merge_branch_into_current(
    into_branch: String,
    from_branch: String,
    state: State<'_, SharedState>,
) -> Result<(), String> {
    run_git_mutation(state.git_service.clone(), None, move |path, git| {
        merge_branch_into(&path, &git, &into_branch, &from_branch).map_err(|e| e.to_string())
    })
    .await
}

#[tauri::command]
pub async fn update_local_branch(
    branch: String,
    state: State<'_, SharedState>,
) -> Result<String, String> {
    run_git_mutation(state.git_service.clone(), None, move |path, git| {
        update_branch(&path, &git, &branch).map_err(|e| e.to_string())
    })
    .await
}

#[tauri::command]
pub async fn pull_remote_into_branch(
    into_branch: String,
    remote_branch: String,
    use_rebase: bool,
    state: State<'_, SharedState>,
) -> Result<String, String> {
    run_git_mutation(state.git_service.clone(), None, move |path, git| {
        pull_remote_into(&path, &git, &into_branch, &remote_branch, use_rebase)
            .map_err(|e| e.to_string())
    })
    .await
}

#[tauri::command]
pub async fn delete_existing_branch(
    name: String,
    force: bool,
    state: State<'_, SharedState>,
) -> Result<(), String> {
    run_git_mutation(state.git_service.clone(), None, move |path, git| {
        delete_branch(&path, &git, &name, force).map_err(|e| e.to_string())
    })
    .await
}

#[tauri::command]
pub async fn delete_remote_branch_ref(
    remote_branch: String,
    state: State<'_, SharedState>,
) -> Result<(), String> {
    run_git_mutation(state.git_service.clone(), None, move |path, git| {
        delete_remote_branch(&path, &git, &remote_branch).map_err(|e| e.to_string())
    })
    .await
}
