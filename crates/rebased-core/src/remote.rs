use std::path::Path;

use crate::{GitCli, RemoteInfo, RemoteOperationResult, Result};

pub fn list_remotes(repo: &Path, git: &GitCli) -> Result<Vec<RemoteInfo>> {
    let names = git.run_ok(repo, &["remote"])?;
    let mut remotes = Vec::new();
    for name in names.lines().filter(|l| !l.is_empty()) {
        let url = git.run_ok(repo, &["remote", "get-url", name])?;
        remotes.push(RemoteInfo {
            name: name.to_string(),
            url,
        });
    }
    Ok(remotes)
}

pub fn fetch(repo: &Path, git: &GitCli, remote: &str) -> Result<RemoteOperationResult> {
    run_remote(repo, git, &["fetch", remote])
}

pub fn pull(repo: &Path, git: &GitCli, remote: &str, branch: &str) -> Result<RemoteOperationResult> {
    run_remote(repo, git, &["pull", remote, branch])
}

pub fn push(repo: &Path, git: &GitCli, remote: &str, branch: &str) -> Result<RemoteOperationResult> {
    run_remote(repo, git, &["push", remote, branch])
}

fn run_remote(repo: &Path, git: &GitCli, args: &[&str]) -> Result<RemoteOperationResult> {
    let (success, stdout, stderr) = git.run_allow_fail(repo, args)?;
    let output = if stderr.is_empty() {
        stdout
    } else if stdout.is_empty() {
        stderr.clone()
    } else {
        format!("{stdout}\n{stderr}")
    };
    if success {
        Ok(RemoteOperationResult { success: true, output })
    } else {
        Err(crate::RebasedError::git(output))
    }
}
