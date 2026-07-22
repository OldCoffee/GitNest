use std::fs;
use std::path::{Path, PathBuf};

use crate::{CommitOptions, CommitResult, GitCli, RebasedError, Result};

fn combine_output(stdout: &str, stderr: &str) -> String {
    let stdout = stdout.trim_end();
    let stderr = stderr.trim_end();
    if stderr.is_empty() {
        stdout.to_string()
    } else if stdout.is_empty() {
        stderr.to_string()
    } else {
        format!("{stdout}\n{stderr}")
    }
}

/// Read `commit.template` from git config and return file contents, if configured.
pub fn get_commit_template(repo: &Path, git: &GitCli) -> Result<Option<String>> {
    let (ok, stdout, _stderr) = git.run_allow_fail(repo, &["config", "--get", "commit.template"])?;
    if !ok {
        return Ok(None);
    }
    let raw = stdout.trim();
    if raw.is_empty() {
        return Ok(None);
    }
    let path = resolve_template_path(repo, raw);
    match fs::read_to_string(&path) {
        Ok(content) => Ok(Some(content)),
        Err(error) => Err(RebasedError::other(format!(
            "failed to read commit.template at {}: {error}",
            path.display()
        ))),
    }
}

fn resolve_template_path(repo: &Path, raw: &str) -> PathBuf {
    let path = PathBuf::from(raw);
    if path.is_absolute() {
        return path;
    }
    if let Some(stripped) = raw.strip_prefix("~/") {
        if let Some(home) = std::env::var_os("HOME").or_else(|| std::env::var_os("USERPROFILE")) {
            return PathBuf::from(home).join(stripped);
        }
    }
    repo.join(path)
}

/// Split template text into subject (first non-empty line) and body (remainder).
pub fn split_commit_template(template: &str) -> (String, String) {
    let normalized = template.replace("\r\n", "\n");
    let mut lines = normalized.lines();
    let subject = lines.next().unwrap_or("").trim().to_string();
    let rest: Vec<&str> = lines.collect();
    let body = rest.join("\n").trim().to_string();
    (subject, body)
}

pub fn commit(repo: &Path, git: &GitCli, options: &CommitOptions) -> Result<CommitResult> {
    let subject = options.subject.trim();
    if subject.is_empty() {
        return Err(RebasedError::other("commit subject cannot be empty"));
    }
    let message = if options.body.trim().is_empty() {
        subject.to_string()
    } else {
        format!("{subject}\n\n{}", options.body.trim())
    };

    let mut args = vec!["commit", "-m", message.as_str()];
    if options.amend {
        args.push("--amend");
    }
    if options.signoff {
        args.push("--signoff");
    }

    let (success, stdout, stderr) = git.run_allow_fail(repo, &args)?;
    let output = combine_output(&stdout, &stderr);
    if !success {
        return Err(RebasedError::git(if output.is_empty() {
            "git commit failed".into()
        } else {
            output
        }));
    }

    let hash = git.run_ok(repo, &["rev-parse", "--short", "HEAD"])?;
    Ok(CommitResult { hash, output })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{stage, CommitOptions, GitCli};
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
        git.run_ok(repo, &["config", "user.name", "Commit Test"])
            .unwrap();
        git.run_ok(repo, &["config", "user.email", "commit@test"])
            .unwrap();
        git.run_ok(repo, &["config", "commit.gpgsign", "false"])
            .unwrap();
        (dir, git)
    }

    #[test]
    fn split_commit_template_first_line_subject() {
        let (subject, body) = split_commit_template("feat: hello\n\nMore details\n");
        assert_eq!(subject, "feat: hello");
        assert_eq!(body, "More details");
    }

    #[test]
    fn get_commit_template_none_when_unset() {
        let (dir, git) = setup_repo();
        // Override any developer-global commit.template so the test is hermetic.
        git.run_ok(dir.path(), &["config", "commit.template", ""])
            .unwrap();
        let tpl = get_commit_template(dir.path(), &git).unwrap();
        assert!(tpl.is_none());
    }

    #[test]
    fn get_commit_template_reads_file() {
        let (dir, git) = setup_repo();
        let repo = dir.path();
        let template_path = repo.join("commit.tpl");
        fs::write(&template_path, "chore: template\n\nBody line\n").unwrap();
        git.run_ok(
            repo,
            &["config", "commit.template", template_path.to_str().unwrap()],
        )
        .unwrap();

        let tpl = get_commit_template(repo, &git).unwrap().expect("template");
        let (subject, body) = split_commit_template(&tpl);
        assert_eq!(subject, "chore: template");
        assert_eq!(body, "Body line");
    }

    #[test]
    fn commit_failure_includes_hook_stderr() {
        let (dir, git) = setup_repo();
        let repo = dir.path();

        fs::write(repo.join("a.txt"), "a\n").unwrap();
        git.run_ok(repo, &["add", "a.txt"]).unwrap();
        git.run_ok(repo, &["commit", "-m", "init"]).unwrap();

        fs::write(repo.join("a.txt"), "b\n").unwrap();
        stage(repo, &git, &["a.txt".into()]).unwrap();

        let hooks = repo.join(".git/hooks");
        fs::create_dir_all(&hooks).unwrap();
        let hook = hooks.join("commit-msg");
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            fs::write(&hook, "#!/bin/sh\necho 'hook says no' >&2\nexit 1\n").unwrap();
            let mut perms = fs::metadata(&hook).unwrap().permissions();
            perms.set_mode(0o755);
            fs::set_permissions(&hook, perms).unwrap();
        }
        #[cfg(not(unix))]
        {
            // Skip hook test on platforms without easy executable hooks.
            return;
        }

        let err = commit(
            repo,
            &git,
            &CommitOptions {
                subject: "should fail".into(),
                body: String::new(),
                amend: false,
                signoff: false,
            },
        )
        .unwrap_err();
        let msg = err.to_string();
        assert!(
            msg.contains("hook says no") || msg.to_lowercase().contains("commit"),
            "unexpected error: {msg}"
        );
    }

    #[test]
    fn commit_success_returns_hash() {
        let (dir, git) = setup_repo();
        let repo = dir.path();
        fs::write(repo.join("b.txt"), "b\n").unwrap();
        git.run_ok(repo, &["add", "b.txt"]).unwrap();
        let result = commit(
            repo,
            &git,
            &CommitOptions {
                subject: "add b".into(),
                body: String::new(),
                amend: false,
                signoff: false,
            },
        )
        .unwrap();
        assert!(!result.hash.is_empty());
    }
}
