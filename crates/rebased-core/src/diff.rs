use std::path::Path;

use crate::{DiffHunk, DiffLine, DiffLineKind, FileDiff, GitCli, Result};

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum DiffMode {
    Working,
    Staged,
    Commits { base: String, head: String },
}

pub fn diff_working(repo: &Path, git: &GitCli, path: &str) -> Result<FileDiff> {
    let output = git.run_ok(
        repo,
        &["diff", "--no-color", "-U3", "--", path],
    )?;
    parse_unified_diff(path, None, &output)
}

pub fn diff_staged(repo: &Path, git: &GitCli, path: &str) -> Result<FileDiff> {
    let output = git.run_ok(
        repo,
        &["diff", "--cached", "--no-color", "-U3", "--", path],
    )?;
    parse_unified_diff(path, None, &output)
}

pub fn diff_commits(
    repo: &Path,
    git: &GitCli,
    base: &str,
    head: &str,
    path: Option<&str>,
) -> Result<FileDiff> {
    let mut args = vec!["diff", "--no-color", "-U3", base, head, "--"];
    if let Some(p) = path {
        args.push(p);
    } else {
        args.push(".");
    }
    let output = git.run_ok(repo, &args)?;
    parse_unified_diff(path.unwrap_or("."), None, &output)
}

pub fn diff_branch_files(
    repo: &Path,
    git: &GitCli,
    base: &str,
    head: &str,
) -> Result<Vec<String>> {
    let range = format!("{base}...{head}");
    let output = git.run_ok(repo, &["diff", "--name-only", &range])?;
    Ok(output
        .lines()
        .filter(|l| !l.is_empty())
        .map(|l| l.to_string())
        .collect())
}

pub fn diff_branch_range(
    repo: &Path,
    git: &GitCli,
    base: &str,
    head: &str,
    path: &str,
) -> Result<FileDiff> {
    let range = format!("{base}...{head}");
    let output = git.run_ok(
        repo,
        &["diff", "--no-color", "-U3", &range, "--", path],
    )?;
    parse_unified_diff(path, None, &output)
}

pub fn diff_against_branch(
    repo: &Path,
    git: &GitCli,
    branch: &str,
    path: &str,
) -> Result<FileDiff> {
    let output = git.run_ok(
        repo,
        &["diff", "--no-color", "-U3", branch, "--", path],
    )?;
    parse_unified_diff(path, None, &output)
}

pub fn diff_against_branch_files(
    repo: &Path,
    git: &GitCli,
    branch: &str,
) -> Result<Vec<String>> {
    let output = git.run_ok(repo, &["diff", "--name-only", branch])?;
    Ok(output
        .lines()
        .filter(|l| !l.is_empty())
        .map(|l| l.to_string())
        .collect())
}

pub fn diff_commit_files(
    repo: &Path,
    git: &GitCli,
    commit: &str,
) -> Result<Vec<String>> {
    let output = git.run_ok(repo, &["diff-tree", "--no-commit-id", "--name-only", "-r", commit])?;
    Ok(output
        .lines()
        .filter(|l| !l.is_empty())
        .map(|l| l.to_string())
        .collect())
}

fn parse_unified_diff(path: &str, old_path: Option<String>, text: &str) -> Result<FileDiff> {
    if text.contains("Binary files") {
        return Ok(FileDiff {
            path: path.to_string(),
            old_path,
            hunks: Vec::new(),
            is_binary: true,
        });
    }

    let mut hunks = Vec::new();
    let mut current_hunk: Option<DiffHunk> = None;

    for line in text.lines() {
        if line.starts_with("@@ ") {
            if let Some(hunk) = current_hunk.take() {
                hunks.push(hunk);
            }
            if let Some(parsed) = parse_hunk_header(line) {
                current_hunk = Some(parsed);
            }
        } else if let Some(ref mut hunk) = current_hunk {
            if line.starts_with('+') && !line.starts_with("+++") {
                hunk.lines.push(DiffLine {
                    kind: DiffLineKind::Add,
                    content: line[1..].to_string(),
                });
            } else if line.starts_with('-') && !line.starts_with("---") {
                hunk.lines.push(DiffLine {
                    kind: DiffLineKind::Remove,
                    content: line[1..].to_string(),
                });
            } else if line.starts_with(' ') {
                hunk.lines.push(DiffLine {
                    kind: DiffLineKind::Context,
                    content: line[1..].to_string(),
                });
            }
        }
    }
    if let Some(hunk) = current_hunk {
        hunks.push(hunk);
    }

    Ok(FileDiff {
        path: path.to_string(),
        old_path,
        hunks,
        is_binary: false,
    })
}

fn parse_hunk_header(line: &str) -> Option<DiffHunk> {
    // @@ -old_start,old_lines +new_start,new_lines @@
    let parts: Vec<&str> = line.split_whitespace().collect();
    if parts.len() < 3 {
        return None;
    }
    let old = parse_range(parts[1].trim_start_matches('-'))?;
    let new = parse_range(parts[2].trim_start_matches('+'))?;
    Some(DiffHunk {
        old_start: old.0,
        old_lines: old.1,
        new_start: new.0,
        new_lines: new.1,
        lines: Vec::new(),
    })
}

fn parse_range(s: &str) -> Option<(u32, u32)> {
    let (start, count) = if let Some((a, b)) = s.split_once(',') {
        (a.parse().ok()?, b.parse().ok()?)
    } else {
        (s.parse().ok()?, 1)
    };
    Some((start, count))
}
