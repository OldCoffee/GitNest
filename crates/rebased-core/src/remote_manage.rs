use std::path::Path;
use std::process::{Command, Stdio};
use std::thread;
use std::time::{Duration, Instant};

use crate::{GitCli, RemoteInfo, Result};

pub fn add_remote(repo: &Path, git: &GitCli, name: &str, url: &str) -> Result<()> {
    git.run_ok(repo, &["remote", "add", name, url])?;
    Ok(())
}

pub fn remove_remote(repo: &Path, git: &GitCli, name: &str) -> Result<()> {
    git.run_ok(repo, &["remote", "remove", name])?;
    Ok(())
}

pub fn set_remote_url(repo: &Path, git: &GitCli, name: &str, url: &str) -> Result<()> {
    git.run_ok(repo, &["remote", "set-url", name, url])?;
    Ok(())
}

pub fn list_remotes_detailed(repo: &Path, git: &GitCli) -> Result<Vec<RemoteInfo>> {
    crate::list_remotes(repo, git)
}

pub fn create_tag(repo: &Path, git: &GitCli, name: &str, message: Option<&str>) -> Result<()> {
    match message {
        Some(m) => git.run_ok(repo, &["tag", "-a", name, "-m", m])?,
        None => git.run_ok(repo, &["tag", name])?,
    };
    Ok(())
}

pub fn delete_tag(repo: &Path, git: &GitCli, name: &str) -> Result<()> {
    git.run_ok(repo, &["tag", "-d", name])?;
    Ok(())
}

pub fn clone_repo(git: &GitCli, url: &str, path: &str) -> Result<crate::RemoteOperationResult> {
    let mut child = Command::new(&git.git_path)
        .current_dir(Path::new("."))
        .args(["clone", url, path])
        .env("GIT_TERMINAL_PROMPT", "0")
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()?;

    let started = Instant::now();
    let timeout = Duration::from_secs(30 * 60);
    loop {
        if child.try_wait()?.is_some() {
            break;
        }
        if started.elapsed() > timeout {
            let _ = child.kill();
            let _ = child.wait();
            return Err(crate::RebasedError::git(
                "git clone timed out after 30 minutes".to_string(),
            ));
        }
        thread::sleep(Duration::from_millis(120));
    }

    let output = child.wait_with_output()?;
    let success = output.status.success();
    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
    let output = if stderr.is_empty() {
        stdout
    } else {
        format!("{stdout}\n{stderr}")
    };
    if success {
        Ok(crate::RemoteOperationResult {
            success: true,
            output,
        })
    } else {
        Err(crate::RebasedError::git(output))
    }
}
