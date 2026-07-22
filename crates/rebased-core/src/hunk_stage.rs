use std::collections::HashSet;
use std::path::Path;

use crate::{DiffHunk, DiffLine, DiffLineKind, GitCli, RebasedError, Result};

/// Build a single-file unified diff containing one hunk.
pub fn build_hunk_patch(path: &str, hunk: &DiffHunk) -> String {
    let mut out = String::new();
    out.push_str(&format!("diff --git a/{path} b/{path}\n"));
    out.push_str(&format!("--- a/{path}\n"));
    out.push_str(&format!("+++ b/{path}\n"));
    out.push_str(&format!(
        "@@ -{},{} +{},{} @@\n",
        hunk.old_start, hunk.old_lines, hunk.new_start, hunk.new_lines
    ));
    for line in &hunk.lines {
        let prefix = match line.kind {
            DiffLineKind::Context => ' ',
            DiffLineKind::Add => '+',
            DiffLineKind::Remove => '-',
        };
        out.push(prefix);
        out.push_str(&line.content);
        out.push('\n');
    }
    out
}

/// How to treat unselected addition lines when slicing a hunk.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SliceMode {
    /// Stage/unstage into the index: omit unselected `+` lines.
    Index,
    /// Discard from the worktree: keep unselected `+` as context so reverse-apply matches.
    Worktree,
}

/// Slice a hunk to only the selected add/remove lines (indices into `hunk.lines`).
///
/// - Unselected removals become context.
/// - Unselected additions: omitted (`Index`) or context (`Worktree`).
/// - Context lines are always kept.
pub fn slice_hunk(
    hunk: &DiffHunk,
    selected_indices: &[usize],
    mode: SliceMode,
) -> Result<DiffHunk> {
    let selected: HashSet<usize> = selected_indices.iter().copied().collect();
    let mut has_change = false;
    for &idx in &selected {
        let Some(line) = hunk.lines.get(idx) else {
            return Err(RebasedError::git(format!(
                "selected line index {idx} is out of range"
            )));
        };
        match line.kind {
            DiffLineKind::Add | DiffLineKind::Remove => has_change = true,
            DiffLineKind::Context => {
                return Err(RebasedError::git(
                    "selected indices must refer to add/remove lines",
                ));
            }
        }
    }
    if !has_change {
        return Err(RebasedError::git("no add/remove lines selected"));
    }

    let mut lines = Vec::with_capacity(hunk.lines.len());
    let mut old_lineno = hunk.old_start;
    let mut new_lineno = hunk.new_start;
    let mut old_lines = 0u32;
    let mut new_lines = 0u32;

    for (idx, line) in hunk.lines.iter().enumerate() {
        match line.kind {
            DiffLineKind::Context => {
                lines.push(DiffLine {
                    kind: DiffLineKind::Context,
                    content: line.content.clone(),
                    old_lineno: Some(old_lineno),
                    new_lineno: Some(new_lineno),
                });
                old_lineno += 1;
                new_lineno += 1;
                old_lines += 1;
                new_lines += 1;
            }
            DiffLineKind::Remove => {
                if selected.contains(&idx) {
                    lines.push(DiffLine {
                        kind: DiffLineKind::Remove,
                        content: line.content.clone(),
                        old_lineno: Some(old_lineno),
                        new_lineno: None,
                    });
                    old_lineno += 1;
                    old_lines += 1;
                } else {
                    lines.push(DiffLine {
                        kind: DiffLineKind::Context,
                        content: line.content.clone(),
                        old_lineno: Some(old_lineno),
                        new_lineno: Some(new_lineno),
                    });
                    old_lineno += 1;
                    new_lineno += 1;
                    old_lines += 1;
                    new_lines += 1;
                }
            }
            DiffLineKind::Add => {
                if selected.contains(&idx) {
                    lines.push(DiffLine {
                        kind: DiffLineKind::Add,
                        content: line.content.clone(),
                        old_lineno: None,
                        new_lineno: Some(new_lineno),
                    });
                    new_lineno += 1;
                    new_lines += 1;
                } else if mode == SliceMode::Worktree {
                    // Stay on the "new" side so reverse-apply still matches the worktree.
                    lines.push(DiffLine {
                        kind: DiffLineKind::Context,
                        content: line.content.clone(),
                        old_lineno: Some(old_lineno),
                        new_lineno: Some(new_lineno),
                    });
                    old_lineno += 1;
                    new_lineno += 1;
                    old_lines += 1;
                    new_lines += 1;
                }
                // Index mode: omit unselected additions.
            }
        }
    }

    let has_staged_change = lines
        .iter()
        .any(|l| matches!(l.kind, DiffLineKind::Add | DiffLineKind::Remove));
    if !has_staged_change {
        return Err(RebasedError::git("sliced hunk has no changes"));
    }

    Ok(DiffHunk {
        old_start: hunk.old_start,
        old_lines,
        new_start: hunk.new_start,
        new_lines,
        lines,
    })
}

fn apply_cached(repo: &Path, git: &GitCli, patch: &str, reverse: bool) -> Result<()> {
    let mut args = vec!["apply", "--cached", "--whitespace=nowarn"];
    if reverse {
        args.push("--reverse");
    }
    git.run_ok_with_stdin(repo, &args, patch.as_bytes())?;
    Ok(())
}

fn apply_worktree(repo: &Path, git: &GitCli, patch: &str, reverse: bool) -> Result<()> {
    let mut args = vec!["apply", "--whitespace=nowarn"];
    if reverse {
        args.push("--reverse");
    }
    git.run_ok_with_stdin(repo, &args, patch.as_bytes())?;
    Ok(())
}

fn require_path_hunk(path: &str, hunk: &DiffHunk, op: &str) -> Result<()> {
    if path.is_empty() {
        return Err(RebasedError::git(format!("path is required for {op}")));
    }
    if hunk.lines.is_empty() {
        return Err(RebasedError::git(format!("{op}: hunk has no lines")));
    }
    Ok(())
}

/// Stage a single hunk from the working-tree diff into the index.
pub fn stage_hunk(repo: &Path, git: &GitCli, path: &str, hunk: &DiffHunk) -> Result<()> {
    require_path_hunk(path, hunk, "stage_hunk")?;
    let patch = build_hunk_patch(path, hunk);
    apply_cached(repo, git, &patch, false)
}

/// Unstage a single hunk from the index (reverse of staged diff hunk).
pub fn unstage_hunk(repo: &Path, git: &GitCli, path: &str, hunk: &DiffHunk) -> Result<()> {
    require_path_hunk(path, hunk, "unstage_hunk")?;
    let patch = build_hunk_patch(path, hunk);
    apply_cached(repo, git, &patch, true)
}

/// Stage only the selected add/remove lines within a working-tree hunk.
pub fn stage_lines(
    repo: &Path,
    git: &GitCli,
    path: &str,
    hunk: &DiffHunk,
    selected_indices: &[usize],
) -> Result<()> {
    require_path_hunk(path, hunk, "stage_lines")?;
    let sliced = slice_hunk(hunk, selected_indices, SliceMode::Index)?;
    let patch = build_hunk_patch(path, &sliced);
    apply_cached(repo, git, &patch, false)
}

/// Unstage only the selected add/remove lines within a staged hunk.
pub fn unstage_lines(
    repo: &Path,
    git: &GitCli,
    path: &str,
    hunk: &DiffHunk,
    selected_indices: &[usize],
) -> Result<()> {
    require_path_hunk(path, hunk, "unstage_lines")?;
    let sliced = slice_hunk(hunk, selected_indices, SliceMode::Index)?;
    let patch = build_hunk_patch(path, &sliced);
    apply_cached(repo, git, &patch, true)
}

/// Discard an entire working-tree hunk (reverse-apply to worktree).
pub fn discard_hunk(repo: &Path, git: &GitCli, path: &str, hunk: &DiffHunk) -> Result<()> {
    require_path_hunk(path, hunk, "discard_hunk")?;
    let patch = build_hunk_patch(path, hunk);
    apply_worktree(repo, git, &patch, true)
}

/// Discard only the selected add/remove lines within a working-tree hunk.
pub fn discard_lines(
    repo: &Path,
    git: &GitCli,
    path: &str,
    hunk: &DiffHunk,
    selected_indices: &[usize],
) -> Result<()> {
    require_path_hunk(path, hunk, "discard_lines")?;
    let sliced = slice_hunk(hunk, selected_indices, SliceMode::Worktree)?;
    let patch = build_hunk_patch(path, &sliced);
    apply_worktree(repo, git, &patch, true)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{diff_staged, diff_working, DiffLine, DiffLineKind};
    use std::fs;
    use std::process::Command;
    use tempfile::tempdir;

    fn setup_repo() -> (tempfile::TempDir, GitCli) {
        let dir = tempdir().expect("tempdir");
        let repo = dir.path();
        let status = Command::new("git")
            .args(["-c", "init.templateDir=", "init", "-b", "main"])
            .env("GIT_CONFIG_NOSYSTEM", "1")
            .env("HOME", repo)
            .current_dir(repo)
            .status()
            .expect("git init");
        assert!(status.success());
        let git = GitCli::default();
        git.run_ok(repo, &["config", "user.name", "Hunk Test"])
            .unwrap();
        git.run_ok(repo, &["config", "user.email", "hunk@test"])
            .unwrap();
        git.run_ok(repo, &["config", "commit.gpgsign", "false"])
            .unwrap();
        (dir, git)
    }

    #[test]
    fn build_hunk_patch_format() {
        let hunk = DiffHunk {
            old_start: 1,
            old_lines: 2,
            new_start: 1,
            new_lines: 3,
            lines: vec![
                DiffLine {
                    kind: DiffLineKind::Context,
                    content: "a".into(),
                    old_lineno: Some(1),
                    new_lineno: Some(1),
                },
                DiffLine {
                    kind: DiffLineKind::Remove,
                    content: "b".into(),
                    old_lineno: Some(2),
                    new_lineno: None,
                },
                DiffLine {
                    kind: DiffLineKind::Add,
                    content: "b2".into(),
                    old_lineno: None,
                    new_lineno: Some(2),
                },
                DiffLine {
                    kind: DiffLineKind::Add,
                    content: "c".into(),
                    old_lineno: None,
                    new_lineno: Some(3),
                },
            ],
        };
        let patch = build_hunk_patch("f.txt", &hunk);
        assert!(patch.contains("--- a/f.txt\n"));
        assert!(patch.contains("+++ b/f.txt\n"));
        assert!(patch.contains("@@ -1,2 +1,3 @@\n"));
        assert!(patch.contains(" a\n"));
        assert!(patch.contains("-b\n"));
        assert!(patch.contains("+b2\n"));
        assert!(patch.contains("+c\n"));
    }

    #[test]
    fn stage_and_unstage_single_hunk() {
        let (dir, git) = setup_repo();
        let repo = dir.path();

        fs::write(
            repo.join("multi.txt"),
            "line1\nline2\nline3\nline4\nline5\nline6\nline7\nline8\nline9\nline10\n",
        )
        .unwrap();
        git.run_ok(repo, &["add", "multi.txt"]).unwrap();
        git.run_ok(repo, &["commit", "-m", "init"]).unwrap();

        // Two distant edits → typically two hunks with -U3.
        fs::write(
            repo.join("multi.txt"),
            "line1-changed\nline2\nline3\nline4\nline5\nline6\nline7\nline8\nline9\nline10-changed\n",
        )
        .unwrap();

        let working = diff_working(repo, &git, "multi.txt").unwrap();
        assert!(
            working.hunks.len() >= 2,
            "expected at least 2 hunks, got {}",
            working.hunks.len()
        );

        stage_hunk(repo, &git, "multi.txt", &working.hunks[0]).unwrap();

        let staged = diff_staged(repo, &git, "multi.txt").unwrap();
        assert_eq!(staged.hunks.len(), 1);
        assert_eq!(staged.hunks[0].old_start, working.hunks[0].old_start);

        let still_working = diff_working(repo, &git, "multi.txt").unwrap();
        assert!(
            !still_working.hunks.is_empty(),
            "second hunk should remain unstaged"
        );

        unstage_hunk(repo, &git, "multi.txt", &staged.hunks[0]).unwrap();
        let staged_after = diff_staged(repo, &git, "multi.txt").unwrap();
        assert!(
            staged_after.hunks.is_empty(),
            "expected empty staged diff after unstage"
        );
    }

    fn sample_hunk() -> DiffHunk {
        DiffHunk {
            old_start: 1,
            old_lines: 3,
            new_start: 1,
            new_lines: 4,
            lines: vec![
                DiffLine {
                    kind: DiffLineKind::Context,
                    content: "a".into(),
                    old_lineno: Some(1),
                    new_lineno: Some(1),
                },
                DiffLine {
                    kind: DiffLineKind::Remove,
                    content: "b".into(),
                    old_lineno: Some(2),
                    new_lineno: None,
                },
                DiffLine {
                    kind: DiffLineKind::Remove,
                    content: "c".into(),
                    old_lineno: Some(3),
                    new_lineno: None,
                },
                DiffLine {
                    kind: DiffLineKind::Add,
                    content: "b2".into(),
                    old_lineno: None,
                    new_lineno: Some(2),
                },
                DiffLine {
                    kind: DiffLineKind::Add,
                    content: "c2".into(),
                    old_lineno: None,
                    new_lineno: Some(3),
                },
                DiffLine {
                    kind: DiffLineKind::Add,
                    content: "d".into(),
                    old_lineno: None,
                    new_lineno: Some(4),
                },
            ],
        }
    }

    #[test]
    fn slice_hunk_partial_additions() {
        let hunk = sample_hunk();
        // Select only the first addition (index 3 = +b2).
        // Unselected removes become context: a, b(ctx), c(ctx), +b2 → old 3, new 4.
        let sliced = slice_hunk(&hunk, &[3], SliceMode::Index).unwrap();
        assert_eq!(sliced.old_lines, 3);
        assert_eq!(sliced.new_lines, 4);
        let kinds: Vec<_> = sliced.lines.iter().map(|l| l.kind).collect();
        assert_eq!(
            kinds,
            vec![
                DiffLineKind::Context,
                DiffLineKind::Context,
                DiffLineKind::Context,
                DiffLineKind::Add,
            ]
        );
        assert_eq!(sliced.lines[3].content, "b2");
    }

    #[test]
    fn slice_hunk_partial_removals() {
        let hunk = sample_hunk();
        // Select only remove "b" (index 1)
        let sliced = slice_hunk(&hunk, &[1], SliceMode::Index).unwrap();
        // a ctx, -b, c→ctx, (adds omitted) → old 3, new 2
        assert_eq!(sliced.old_lines, 3);
        assert_eq!(sliced.new_lines, 2);
        assert!(sliced.lines.iter().any(|l| {
            l.kind == DiffLineKind::Remove && l.content == "b"
        }));
        assert!(!sliced.lines.iter().any(|l| l.kind == DiffLineKind::Add));
    }

    #[test]
    fn slice_hunk_rejects_empty_or_context() {
        let hunk = sample_hunk();
        assert!(slice_hunk(&hunk, &[], SliceMode::Index).is_err());
        assert!(slice_hunk(&hunk, &[0], SliceMode::Index).is_err()); // context
        assert!(slice_hunk(&hunk, &[99], SliceMode::Index).is_err());
    }

    #[test]
    fn stage_selected_addition_only() {
        let (dir, git) = setup_repo();
        let repo = dir.path();

        fs::write(repo.join("sel.txt"), "a\nb\nc\n").unwrap();
        git.run_ok(repo, &["add", "sel.txt"]).unwrap();
        git.run_ok(repo, &["commit", "-m", "init"]).unwrap();

        fs::write(repo.join("sel.txt"), "a\nb\nX\nY\nc\n").unwrap();
        let working = diff_working(repo, &git, "sel.txt").unwrap();
        assert_eq!(working.hunks.len(), 1);
        let hunk = &working.hunks[0];
        let add_indices: Vec<usize> = hunk
            .lines
            .iter()
            .enumerate()
            .filter(|(_, l)| l.kind == DiffLineKind::Add && l.content == "X")
            .map(|(i, _)| i)
            .collect();
        assert_eq!(add_indices.len(), 1);

        stage_lines(repo, &git, "sel.txt", hunk, &add_indices).unwrap();

        let staged = diff_staged(repo, &git, "sel.txt").unwrap();
        assert_eq!(staged.hunks.len(), 1);
        let staged_adds: Vec<_> = staged.hunks[0]
            .lines
            .iter()
            .filter(|l| l.kind == DiffLineKind::Add)
            .map(|l| l.content.as_str())
            .collect();
        assert_eq!(staged_adds, vec!["X"]);

        let still = diff_working(repo, &git, "sel.txt").unwrap();
        assert!(!still.hunks.is_empty());
        let remain_adds: Vec<_> = still.hunks[0]
            .lines
            .iter()
            .filter(|l| l.kind == DiffLineKind::Add)
            .map(|l| l.content.as_str())
            .collect();
        assert!(remain_adds.contains(&"Y"));
    }

    #[test]
    fn discard_selected_addition() {
        let (dir, git) = setup_repo();
        let repo = dir.path();

        fs::write(repo.join("drop.txt"), "a\nb\nc\n").unwrap();
        git.run_ok(repo, &["add", "drop.txt"]).unwrap();
        git.run_ok(repo, &["commit", "-m", "init"]).unwrap();

        fs::write(repo.join("drop.txt"), "a\nb\nX\nY\nc\n").unwrap();
        let working = diff_working(repo, &git, "drop.txt").unwrap();
        let hunk = &working.hunks[0];
        let add_x: Vec<usize> = hunk
            .lines
            .iter()
            .enumerate()
            .filter(|(_, l)| l.kind == DiffLineKind::Add && l.content == "X")
            .map(|(i, _)| i)
            .collect();

        discard_lines(repo, &git, "drop.txt", hunk, &add_x).unwrap();
        let content = fs::read_to_string(repo.join("drop.txt")).unwrap();
        assert!(!content.contains("X\n"));
        assert!(content.contains("Y\n"));
    }
}
