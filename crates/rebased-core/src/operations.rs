use std::path::{Path, PathBuf};

use crate::{GitCli, RemoteOperationResult, Result};

pub fn merge_branch(repo: &Path, git: &GitCli, branch: &str) -> Result<RemoteOperationResult> {
    run(repo, git, &["merge", branch])
}

pub fn merge_abort(repo: &Path, git: &GitCli) -> Result<RemoteOperationResult> {
    run(repo, git, &["merge", "--abort"])
}

pub fn rebase_branch(repo: &Path, git: &GitCli, branch: &str) -> Result<RemoteOperationResult> {
    run(repo, git, &["rebase", branch])
}

pub fn rebase_continue(repo: &Path, git: &GitCli) -> Result<RemoteOperationResult> {
    run(repo, git, &["rebase", "--continue"])
}

pub fn rebase_skip(repo: &Path, git: &GitCli) -> Result<RemoteOperationResult> {
    run(repo, git, &["rebase", "--skip"])
}

pub fn rebase_abort(repo: &Path, git: &GitCli) -> Result<RemoteOperationResult> {
    run(repo, git, &["rebase", "--abort"])
}

pub fn cherry_pick(repo: &Path, git: &GitCli, commit: &str) -> Result<RemoteOperationResult> {
    run(repo, git, &["cherry-pick", commit])
}

pub fn cherry_pick_abort(repo: &Path, git: &GitCli) -> Result<RemoteOperationResult> {
    run(repo, git, &["cherry-pick", "--abort"])
}

pub fn reset(repo: &Path, git: &GitCli, mode: &str, target: &str) -> Result<RemoteOperationResult> {
    let flag = match mode {
        "soft" => "--soft",
        "hard" => "--hard",
        _ => "--mixed",
    };
    run(repo, git, &["reset", flag, target])
}

pub fn revert_commit(repo: &Path, git: &GitCli, commit: &str) -> Result<RemoteOperationResult> {
    run(repo, git, &["revert", "--no-edit", commit])
}

fn run(repo: &Path, git: &GitCli, args: &[&str]) -> Result<RemoteOperationResult> {
    let (success, stdout, stderr) = git.run_allow_fail(repo, args)?;
    let output = combine_output(&stdout, &stderr);
    if success {
        Ok(RemoteOperationResult {
            success: true,
            output,
        })
    } else {
        Err(crate::RebasedError::git(output))
    }
}

fn combine_output(stdout: &str, stderr: &str) -> String {
    if stderr.is_empty() {
        stdout.to_string()
    } else if stdout.is_empty() {
        stderr.to_string()
    } else {
        format!("{stdout}\n{stderr}")
    }
}

pub fn repo_operation_state(repo: &Path, git: &GitCli) -> crate::RepoOperationState {
    let git_dir = repo.join(".git");
    let merging = git_dir.join("MERGE_HEAD").exists();
    let rebasing = git_dir.join("rebase-merge").exists() || git_dir.join("rebase-apply").exists();
    let cherry_picking = git_dir.join("CHERRY_PICK_HEAD").exists();
    let reverting = git_dir.join("REVERT_HEAD").exists();
    let merge_head = read_file_if_exists(&git_dir.join("MERGE_HEAD"));
    let conflict_count = git
        .run_ok(repo, &["diff", "--name-only", "--diff-filter=U"])
        .map(|s| s.lines().filter(|l| !l.is_empty()).count() as u32)
        .unwrap_or(0);
    crate::RepoOperationState {
        merging,
        merge_head,
        rebasing,
        cherry_picking,
        reverting,
        conflict_count,
    }
}

fn read_file_if_exists(path: &PathBuf) -> Option<String> {
    std::fs::read_to_string(path)
        .ok()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
}
