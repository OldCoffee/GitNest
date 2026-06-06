use std::io::Read;
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc;
use std::sync::Arc;
use std::thread;
use std::time::{Duration, Instant};

use rebased_core::{
    add_remote, create_tag, delete_tag, list_merge_requests, list_pull_requests,
    remove_remote, set_remote_url, verify_github_token, verify_gitlab_token, GitHubAccount,
    GitLabAccount, MergeRequestEntry, PullRequestEntry, RemoteOperationResult,
};
use serde::Serialize;
use tauri::{Emitter, State};

use crate::state::SharedState;

#[tauri::command]
pub fn github_verify(account: GitHubAccount) -> Result<String, String> {
    verify_github_token(&account).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn github_list_prs(
    account: GitHubAccount,
    repo: String,
) -> Result<Vec<PullRequestEntry>, String> {
    list_pull_requests(&account, &repo).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn gitlab_verify(account: GitLabAccount) -> Result<String, String> {
    verify_gitlab_token(&account).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn gitlab_list_mrs(
    account: GitLabAccount,
    project: String,
) -> Result<Vec<MergeRequestEntry>, String> {
    list_merge_requests(&account, &project).map_err(|e| e.to_string())
}

#[derive(Clone, Serialize)]
struct GitCloneOutput {
    clone_id: String,
    stream: String,
    chunk: String,
}

fn read_stream<R: Read + Send + 'static>(
    mut reader: R,
    stream: &'static str,
    tx: mpsc::Sender<GitCloneOutput>,
    clone_id: String,
) {
    thread::spawn(move || {
        let mut buf = [0_u8; 1024];
        loop {
            match reader.read(&mut buf) {
                Ok(0) => break,
                Ok(n) => {
                    let chunk = String::from_utf8_lossy(&buf[..n]).to_string();
                    if tx
                        .send(GitCloneOutput {
                            clone_id: clone_id.clone(),
                            stream: stream.to_string(),
                            chunk,
                        })
                        .is_err()
                    {
                        break;
                    }
                }
                Err(_) => break,
            }
        }
    });
}

#[tauri::command]
pub async fn git_clone(
    url: String,
    path: String,
    clone_id: String,
    state: State<'_, SharedState>,
    app: tauri::AppHandle,
) -> Result<RemoteOperationResult, String> {
    let shared = state.inner().clone();
    let settings = shared.settings_snapshot();
    let git_path = settings.git_path;

    let cancel = Arc::new(AtomicBool::new(false));
    shared
        .clone_cancels
        .lock()
        .insert(clone_id.clone(), cancel.clone());

    let cleanup_id = clone_id.clone();
    let result = tauri::async_runtime::spawn_blocking(move || {
        run_clone(git_path, url, path, clone_id, app, cancel)
    })
    .await
    .map_err(|e| e.to_string());

    shared.clone_cancels.lock().remove(&cleanup_id);
    result?
}

#[tauri::command]
pub fn cancel_clone(clone_id: String, state: State<'_, SharedState>) {
    if let Some(flag) = state.clone_cancels.lock().get(&clone_id) {
        flag.store(true, Ordering::SeqCst);
    }
}

fn run_clone(
    git_path: String,
    url: String,
    path: String,
    clone_id: String,
    app: tauri::AppHandle,
    cancel: Arc<AtomicBool>,
) -> Result<RemoteOperationResult, String> {
    let mut child = Command::new(&git_path)
        .args(["clone", "--progress", &url, &path])
        .env("GIT_TERMINAL_PROMPT", "0")
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| e.to_string())?;

    let (tx, rx) = mpsc::channel();
    if let Some(stdout) = child.stdout.take() {
        read_stream(stdout, "stdout", tx.clone(), clone_id.clone());
    }
    if let Some(stderr) = child.stderr.take() {
        read_stream(stderr, "stderr", tx.clone(), clone_id.clone());
    }
    drop(tx);

    let started = Instant::now();
    let timeout = Duration::from_secs(30 * 60);
    let mut output = String::new();
    let status = loop {
        while let Ok(event) = rx.try_recv() {
            output.push_str(&event.chunk);
            let _ = app.emit("git-clone-output", event);
        }

        if cancel.load(Ordering::SeqCst) {
            let _ = child.kill();
            let _ = child.wait();
            let chunk = "\nClone canceled. Removing target folder…\n".to_string();
            let _ = app.emit(
                "git-clone-output",
                GitCloneOutput {
                    clone_id: clone_id.clone(),
                    stream: "stderr".to_string(),
                    chunk: chunk.clone(),
                },
            );
            output.push_str(&chunk);
            let _ = std::fs::remove_dir_all(&path);
            return Ok(RemoteOperationResult {
                success: false,
                output,
            });
        }

        if let Some(status) = child.try_wait().map_err(|e| e.to_string())? {
            break status;
        }

        if started.elapsed() > timeout {
            let _ = child.kill();
            let _ = child.wait();
            let chunk = "git clone timed out after 30 minutes\n".to_string();
            let _ = app.emit(
                "git-clone-output",
                GitCloneOutput {
                    clone_id: clone_id.clone(),
                    stream: "stderr".to_string(),
                    chunk: chunk.clone(),
                },
            );
            output.push_str(&chunk);
            return Ok(RemoteOperationResult {
                success: false,
                output,
            });
        }

        thread::sleep(Duration::from_millis(80));
    };

    while let Ok(event) = rx.recv_timeout(Duration::from_millis(20)) {
        output.push_str(&event.chunk);
        let _ = app.emit("git-clone-output", event);
    }

    Ok(RemoteOperationResult {
        success: status.success(),
        output,
    })
}

#[tauri::command]
pub fn git_add_remote(name: String, url: String, state: State<'_, SharedState>) -> Result<(), String> {
    state.with_repo(|repo| add_remote(repo.path(), repo.git(), &name, &url))
}

#[tauri::command]
pub fn git_remove_remote(name: String, state: State<'_, SharedState>) -> Result<(), String> {
    state.with_repo(|repo| remove_remote(repo.path(), repo.git(), &name))
}

#[tauri::command]
pub fn git_set_remote_url(
    name: String,
    url: String,
    state: State<'_, SharedState>,
) -> Result<(), String> {
    state.with_repo(|repo| set_remote_url(repo.path(), repo.git(), &name, &url))
}

#[tauri::command]
pub fn git_create_tag(
    name: String,
    message: Option<String>,
    state: State<'_, SharedState>,
) -> Result<(), String> {
    state.with_repo(|repo| create_tag(repo.path(), repo.git(), &name, message.as_deref()))
}

#[tauri::command]
pub fn git_delete_tag(name: String, state: State<'_, SharedState>) -> Result<(), String> {
    state.with_repo(|repo| delete_tag(repo.path(), repo.git(), &name))
}
