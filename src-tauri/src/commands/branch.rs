use rebased_core::{
    checkout, checkout_and_rebase, create_branch, create_branch_from as core_create_branch_from,
    delete_branch, delete_remote_branch, list_branches, merge_branch_into, pull_remote_into,
    rebase_branch_onto, rename_branch as core_rename_branch, update_branch, BranchInfo,
};
use tauri::State;

use crate::state::SharedState;

#[tauri::command]
pub fn get_branches(state: State<'_, SharedState>) -> Result<Vec<BranchInfo>, String> {
    state.with_repo(|repo| list_branches(repo.path(), repo.git()))
}

#[tauri::command]
pub fn checkout_branch(name: String, state: State<'_, SharedState>) -> Result<(), String> {
    state.with_repo(|repo| checkout(repo.path(), repo.git(), &name))
}

#[tauri::command]
pub fn create_new_branch(name: String, state: State<'_, SharedState>) -> Result<(), String> {
    state.with_repo(|repo| create_branch(repo.path(), repo.git(), &name))
}

#[tauri::command]
pub fn create_branch_from(
    name: String,
    start_point: String,
    state: State<'_, SharedState>,
) -> Result<(), String> {
    state.with_repo(|repo| core_create_branch_from(repo.path(), repo.git(), &name, &start_point))
}

#[tauri::command]
pub fn rename_branch(
    old_name: String,
    new_name: String,
    state: State<'_, SharedState>,
) -> Result<(), String> {
    state.with_repo(|repo| core_rename_branch(repo.path(), repo.git(), &old_name, &new_name))
}

#[tauri::command]
pub fn checkout_and_rebase_onto(
    branch: String,
    onto: String,
    state: State<'_, SharedState>,
) -> Result<(), String> {
    state.with_repo(|repo| checkout_and_rebase(repo.path(), repo.git(), &branch, &onto))
}

#[tauri::command]
pub fn rebase_current_onto(
    base_branch: String,
    onto_branch: String,
    state: State<'_, SharedState>,
) -> Result<(), String> {
    state.with_repo(|repo| {
        rebase_branch_onto(repo.path(), repo.git(), &base_branch, &onto_branch)
    })
}

#[tauri::command]
pub fn merge_branch_into_current(
    into_branch: String,
    from_branch: String,
    state: State<'_, SharedState>,
) -> Result<(), String> {
    state.with_repo(|repo| {
        merge_branch_into(repo.path(), repo.git(), &into_branch, &from_branch)
    })
}

#[tauri::command]
pub fn update_local_branch(
    branch: String,
    state: State<'_, SharedState>,
) -> Result<String, String> {
    state.with_repo(|repo| update_branch(repo.path(), repo.git(), &branch))
}

#[tauri::command]
pub fn pull_remote_into_branch(
    into_branch: String,
    remote_branch: String,
    use_rebase: bool,
    state: State<'_, SharedState>,
) -> Result<String, String> {
    state.with_repo(|repo| {
        pull_remote_into(
            repo.path(),
            repo.git(),
            &into_branch,
            &remote_branch,
            use_rebase,
        )
    })
}

#[tauri::command]
pub fn delete_existing_branch(
    name: String,
    force: bool,
    state: State<'_, SharedState>,
) -> Result<(), String> {
    state.with_repo(|repo| delete_branch(repo.path(), repo.git(), &name, force))
}

#[tauri::command]
pub fn delete_remote_branch_ref(
    remote_branch: String,
    state: State<'_, SharedState>,
) -> Result<(), String> {
    state.with_repo(|repo| delete_remote_branch(repo.path(), repo.git(), &remote_branch))
}
