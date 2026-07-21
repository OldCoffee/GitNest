use std::path::Path;

use crate::{DiffHunk, DiffLineKind, GitCli, RebasedError, Result};

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

fn apply_cached(repo: &Path, git: &GitCli, patch: &str, reverse: bool) -> Result<()> {
    let mut args = vec!["apply", "--cached", "--whitespace=nowarn"];
    if reverse {
        args.push("--reverse");
    }
    git.run_ok_with_stdin(repo, &args, patch.as_bytes())?;
    Ok(())
}

/// Stage a single hunk from the working-tree diff into the index.
pub fn stage_hunk(repo: &Path, git: &GitCli, path: &str, hunk: &DiffHunk) -> Result<()> {
    if path.is_empty() {
        return Err(RebasedError::git("path is required for stage_hunk"));
    }
    if hunk.lines.is_empty() {
        return Err(RebasedError::git("hunk has no lines"));
    }
    let patch = build_hunk_patch(path, hunk);
    apply_cached(repo, git, &patch, false)
}

/// Unstage a single hunk from the index (reverse of staged diff hunk).
pub fn unstage_hunk(repo: &Path, git: &GitCli, path: &str, hunk: &DiffHunk) -> Result<()> {
    if path.is_empty() {
        return Err(RebasedError::git("path is required for unstage_hunk"));
    }
    if hunk.lines.is_empty() {
        return Err(RebasedError::git("hunk has no lines"));
    }
    let patch = build_hunk_patch(path, hunk);
    apply_cached(repo, git, &patch, true)
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
}
