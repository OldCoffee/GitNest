use std::path::Path;

use crate::{FileChange, FileStatusKind, GitCli, RebasedError, Result, StatusSnapshot};

pub fn status(repo: &Path, git: &GitCli) -> Result<StatusSnapshot> {
    // NOTE: do not use `run_ok` here: it trims the whole output, which strips the
    // leading status space of the very first porcelain line (e.g. " M .gitignore"),
    // shifting the parse and corrupting that entry's status/path.
    let (ok, porcelain, stderr) =
        git.run_allow_fail(repo, &["status", "--porcelain", "-uall"])?;
    if !ok {
        return Err(RebasedError::git(format!(
            "git status failed: {}",
            stderr.trim()
        )));
    }
    let mut staged = Vec::new();
    let mut unstaged = Vec::new();
    let mut untracked = Vec::new();
    let mut conflicted = Vec::new();

    for line in porcelain.lines() {
        if line.len() < 3 {
            continue;
        }
        let index_status = line.as_bytes()[0] as char;
        let worktree_status = line.as_bytes()[1] as char;
        let path_part = line[3..].trim();
        let (path, old_path) = if let Some((new, old)) = path_part.split_once(" -> ") {
            (new.to_string(), Some(old.to_string()))
        } else {
            (path_part.to_string(), None)
        };

        let is_conflict = index_status == 'U'
            || worktree_status == 'U'
            || (index_status == 'A' && worktree_status == 'A')
            || (index_status == 'D' && worktree_status == 'D');

        if is_conflict {
            conflicted.push(FileChange {
                path: path.clone(),
                old_path: old_path.clone(),
                status: FileStatusKind::Conflicted,
                staged: index_status != ' ',
            });
        }

        if index_status == '?' && worktree_status == '?' {
            untracked.push(FileChange {
                path,
                old_path: None,
                status: FileStatusKind::Untracked,
                staged: false,
            });
            continue;
        }

        if index_status != ' ' && index_status != '?' {
            staged.push(FileChange {
                path: path.clone(),
                old_path: old_path.clone(),
                status: index_char_to_status(index_status),
                staged: true,
            });
        }

        if worktree_status != ' ' && worktree_status != '?' && !is_conflict {
            unstaged.push(FileChange {
                path,
                old_path,
                status: worktree_char_to_status(worktree_status),
                staged: false,
            });
        }
    }

    Ok(StatusSnapshot {
        staged,
        unstaged,
        untracked,
        conflicted,
    })
}

fn index_char_to_status(c: char) -> FileStatusKind {
    match c {
        'M' => FileStatusKind::Modified,
        'A' => FileStatusKind::Added,
        'D' => FileStatusKind::Deleted,
        'R' => FileStatusKind::Renamed,
        'C' => FileStatusKind::Copied,
        'U' => FileStatusKind::Conflicted,
        _ => FileStatusKind::Modified,
    }
}

fn worktree_char_to_status(c: char) -> FileStatusKind {
    index_char_to_status(c)
}

pub fn stage(repo: &Path, git: &GitCli, paths: &[String]) -> Result<()> {
    if paths.is_empty() {
        return Ok(());
    }
    let mut args = vec!["add", "--"];
    let path_refs: Vec<&str> = paths.iter().map(String::as_str).collect();
    args.extend(path_refs);
    git.run_ok(repo, &args)?;
    Ok(())
}

pub fn unstage(repo: &Path, git: &GitCli, paths: &[String]) -> Result<()> {
    if paths.is_empty() {
        return Ok(());
    }
    let mut args = vec!["restore", "--staged", "--"];
    let path_refs: Vec<&str> = paths.iter().map(String::as_str).collect();
    args.extend(path_refs);
    git.run_ok(repo, &args)?;
    Ok(())
}

pub fn stage_all(repo: &Path, git: &GitCli) -> Result<()> {
    git.run_ok(repo, &["add", "-A"])?;
    Ok(())
}

pub fn unstage_all(repo: &Path, git: &GitCli) -> Result<()> {
    git.run_ok(repo, &["restore", "--staged", "."])?;
    Ok(())
}

pub fn discard(repo: &Path, git: &GitCli, paths: &[String]) -> Result<()> {
    if paths.is_empty() {
        return Ok(());
    }
    let mut args = vec!["restore", "--"];
    let path_refs: Vec<&str> = paths.iter().map(String::as_str).collect();
    args.extend(path_refs);
    git.run_ok(repo, &args)?;
    Ok(())
}

pub fn checkout_ours(repo: &Path, git: &GitCli, path: &str) -> Result<()> {
    git.run_ok(repo, &["checkout", "--ours", "--", path])?;
    stage(repo, git, &[path.to_string()])
}

pub fn checkout_theirs(repo: &Path, git: &GitCli, path: &str) -> Result<()> {
    git.run_ok(repo, &["checkout", "--theirs", "--", path])?;
    stage(repo, git, &[path.to_string()])
}
