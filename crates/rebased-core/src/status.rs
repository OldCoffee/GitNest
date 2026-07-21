use std::collections::HashMap;
use std::path::Path;

use crate::{FileChange, FileStatusKind, GitCli, RebasedError, Result, StatusSnapshot};

/// Parses `git diff --numstat` output into a `path -> (additions, deletions)`
/// map. Binary files (reported as `-`) are skipped.
fn parse_numstat(output: &str) -> HashMap<String, (u32, u32)> {
    let mut map = HashMap::new();
    for line in output.lines() {
        let mut parts = line.splitn(3, '\t');
        let (Some(add), Some(del), Some(path)) = (parts.next(), parts.next(), parts.next()) else {
            continue;
        };
        let (add, del) = match (add.parse::<u32>(), del.parse::<u32>()) {
            (Ok(a), Ok(d)) => (a, d),
            _ => continue, // binary "-\t-"
        };
        // Renames look like "old => new" or ".../{old => new}/..."; key on the
        // resolved new path so it matches the porcelain entry.
        let key = resolve_numstat_path(path);
        map.insert(key, (add, del));
    }
    map
}

fn resolve_numstat_path(raw: &str) -> String {
    if let (Some(open), Some(arrow), Some(close)) = (raw.find('{'), raw.find(" => "), raw.find('}'))
    {
        if open < arrow && arrow < close {
            let prefix = &raw[..open];
            let new_mid = &raw[arrow + 4..close];
            let suffix = &raw[close + 1..];
            return format!("{prefix}{new_mid}{suffix}").replace("//", "/");
        }
    }
    if let Some((_, new)) = raw.split_once(" => ") {
        return new.to_string();
    }
    raw.to_string()
}

pub fn status(repo: &Path, git: &GitCli) -> Result<StatusSnapshot> {
    // NOTE: do not use `run_ok` here: it trims the whole output, which strips the
    // leading status space of the very first porcelain line (e.g. " M .gitignore"),
    // shifting the parse and corrupting that entry's status/path.
    let (ok, porcelain, stderr) = git.run_allow_fail(repo, &["status", "--porcelain", "-uall"])?;
    if !ok {
        return Err(RebasedError::git(format!(
            "git status failed: {}",
            stderr.trim()
        )));
    }
    // Per-file line counts. Best-effort: ignore failures so status still works.
    let staged_stats = git
        .run_allow_fail(repo, &["diff", "--cached", "--numstat"])
        .ok()
        .filter(|(ok, _, _)| *ok)
        .map(|(_, out, _)| parse_numstat(&out))
        .unwrap_or_default();
    let worktree_stats = git
        .run_allow_fail(repo, &["diff", "--numstat"])
        .ok()
        .filter(|(ok, _, _)| *ok)
        .map(|(_, out, _)| parse_numstat(&out))
        .unwrap_or_default();

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
                additions: None,
                deletions: None,
            });
        }

        if index_status == '?' && worktree_status == '?' {
            untracked.push(FileChange {
                path,
                old_path: None,
                status: FileStatusKind::Untracked,
                staged: false,
                additions: None,
                deletions: None,
            });
            continue;
        }

        if index_status != ' ' && index_status != '?' {
            let stat = staged_stats.get(&path).copied();
            staged.push(FileChange {
                path: path.clone(),
                old_path: old_path.clone(),
                status: index_char_to_status(index_status),
                staged: true,
                additions: stat.map(|s| s.0),
                deletions: stat.map(|s| s.1),
            });
        }

        if worktree_status != ' ' && worktree_status != '?' && !is_conflict {
            let stat = worktree_stats.get(&path).copied();
            unstaged.push(FileChange {
                path,
                old_path,
                status: worktree_char_to_status(worktree_status),
                staged: false,
                additions: stat.map(|s| s.0),
                deletions: stat.map(|s| s.1),
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
