//! Integration smoke: open repo → edit → stage → commit → log.
use std::fs;
use std::process::Command;

use rebased_core::{commit, log_page, stage, status, CommitOptions, GitCli, LogFilters};
use tempfile::tempdir;

fn git_config(repo: &std::path::Path, key: &str, value: &str) {
    let status = Command::new("git")
        .args(["config", key, value])
        .current_dir(repo)
        .status()
        .expect("git config");
    assert!(status.success(), "git config {key} failed");
}

#[test]
fn open_edit_stage_commit_log() {
    let dir = tempdir().expect("tempdir");
    let repo = dir.path();
    let git = GitCli::default();

    let init = Command::new("git")
        .args(["-c", "init.templateDir=", "init", "-b", "main"])
        .env("GIT_CONFIG_NOSYSTEM", "1")
        .env("HOME", repo)
        .current_dir(repo)
        .status()
        .expect("git init");
    assert!(init.success());
    git_config(repo, "user.name", "GitNest Smoke");
    git_config(repo, "user.email", "smoke@gitnest.test");
    // Avoid signing / hooks in CI sandboxes
    git_config(repo, "commit.gpgsign", "false");

    fs::write(repo.join("README.md"), "# Demo\n").unwrap();
    git.run_ok(repo, &["add", "README.md"]).unwrap();
    git.run_ok(repo, &["commit", "-m", "chore: init"]).unwrap();

    fs::write(repo.join("README.md"), "# Demo\n\nEdited\n").unwrap();
    let snap = status(repo, &git).unwrap();
    assert!(
        snap.unstaged.iter().any(|f| f.path == "README.md"),
        "expected README.md in unstaged: {snap:?}"
    );

    stage(repo, &git, &["README.md".into()]).unwrap();
    let staged = status(repo, &git).unwrap();
    assert!(
        staged.staged.iter().any(|f| f.path == "README.md"),
        "expected README.md staged: {staged:?}"
    );

    let result = commit(
        repo,
        &git,
        &CommitOptions {
            subject: "docs: update readme".into(),
            body: String::new(),
            amend: false,
            signoff: false,
        },
    )
    .unwrap();
    assert!(!result.hash.is_empty());

    let page = log_page(repo, &git, None, 0, 20, &LogFilters::default()).unwrap();
    assert!(
        page.iter().any(|c| c.subject == "docs: update readme"),
        "commit missing from log: {page:?}"
    );
}
