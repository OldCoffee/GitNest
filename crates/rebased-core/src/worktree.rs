use std::path::Path;

use crate::{GitCli, Result, WorktreeEntry};

pub fn list_worktrees(repo: &Path, git: &GitCli) -> Result<Vec<WorktreeEntry>> {
    let output = git.run_ok(repo, &["worktree", "list", "--porcelain"])?;
    let mut entries = Vec::new();
    let mut path = String::new();
    let mut head = String::new();
    let mut branch: Option<String> = None;
    let mut is_bare = false;

    for line in output.lines() {
        if let Some(rest) = line.strip_prefix("worktree ") {
            if !path.is_empty() {
                entries.push(WorktreeEntry {
                    path: path.clone(),
                    branch: branch.clone(),
                    head: head.clone(),
                    is_bare,
                });
            }
            path = rest.to_string();
            head.clear();
            branch = None;
            is_bare = false;
        } else if let Some(rest) = line.strip_prefix("HEAD ") {
            head = rest.to_string();
        } else if let Some(rest) = line.strip_prefix("branch refs/heads/") {
            branch = Some(rest.to_string());
        } else if let Some(rest) = line.strip_prefix("branch ") {
            branch = Some(rest.to_string());
        } else if line == "bare" {
            is_bare = true;
        } else if line.is_empty() {
            entries.push(WorktreeEntry {
                path: path.clone(),
                branch: branch.clone(),
                head: head.clone(),
                is_bare,
            });
            path.clear();
        }
    }
    if !path.is_empty() {
        entries.push(WorktreeEntry {
            path,
            branch,
            head,
            is_bare,
        });
    }
    Ok(entries)
}

pub fn add_worktree(repo: &Path, git: &GitCli, path: &str, branch: Option<&str>) -> Result<()> {
    match branch {
        Some(b) => git.run_ok(repo, &["worktree", "add", path, b])?,
        None => git.run_ok(repo, &["worktree", "add", path])?,
    };
    Ok(())
}

pub fn remove_worktree(repo: &Path, git: &GitCli, path: &str, force: bool) -> Result<()> {
    if force {
        git.run_ok(repo, &["worktree", "remove", "--force", path])?;
    } else {
        git.run_ok(repo, &["worktree", "remove", path])?;
    }
    Ok(())
}
