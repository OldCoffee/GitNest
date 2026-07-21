use std::collections::HashMap;
use std::io::{BufRead, BufReader, Read, Write};
use std::path::Path;
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{Duration, Instant};

use parking_lot::Mutex;
use serde::Serialize;
use serde_json::Value;
use tauri::{AppHandle, Emitter};

struct LspSession {
    child: Child,
    stdin: ChildStdin,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LspMessage {
    pub session_id: u64,
    pub message: Value,
}

#[derive(Default)]
pub struct LspService {
    next_id: AtomicU64,
    sessions: Mutex<HashMap<u64, LspSession>>,
}

impl LspService {
    pub fn start(
        &self,
        app: AppHandle,
        executable: &Path,
        args: &[String],
        cwd: &Path,
        env: &[(String, String)],
    ) -> Result<u64, String> {
        let mut command = Command::new(executable);
        command
            .args(args)
            .current_dir(cwd)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        for (key, value) in env {
            command.env(key, value);
        }
        let mut child = command.spawn().map_err(|error| error.to_string())?;
        // Prefer UI responsiveness while the JVM boots and indexes.
        #[cfg(unix)]
        {
            let pid = child.id().to_string();
            let _ = Command::new("renice")
                .args(["+10", "-p", &pid])
                .stdout(Stdio::null())
                .stderr(Stdio::null())
                .status();
        }
        let stdin = child
            .stdin
            .take()
            .ok_or_else(|| "language server stdin unavailable".to_string())?;
        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| "language server stdout unavailable".to_string())?;
        let stderr = child.stderr.take();
        let session_id = self.next_id.fetch_add(1, Ordering::Relaxed) + 1;

        let message_app = app.clone();
        std::thread::spawn(move || read_messages(session_id, stdout, message_app));
        if let Some(stderr) = stderr {
            std::thread::spawn(move || {
                for line in BufReader::new(stderr).lines().map_while(Result::ok) {
                    let _ = app.emit(
                        "lsp-log",
                        serde_json::json!({ "sessionId": session_id, "message": line }),
                    );
                }
            });
        }

        self.sessions
            .lock()
            .insert(session_id, LspSession { child, stdin });
        Ok(session_id)
    }

    pub fn send(&self, session_id: u64, message: &Value) -> Result<(), String> {
        let body = serde_json::to_vec(message).map_err(|error| error.to_string())?;
        let mut sessions = self.sessions.lock();
        let session = sessions
            .get_mut(&session_id)
            .ok_or_else(|| "language server session not found".to_string())?;
        write!(session.stdin, "Content-Length: {}\r\n\r\n", body.len())
            .and_then(|_| session.stdin.write_all(&body))
            .and_then(|_| session.stdin.flush())
            .map_err(|error| error.to_string())
    }

    pub fn stop(&self, session_id: u64) -> Result<(), String> {
        let Some(mut session) = self.sessions.lock().remove(&session_id) else {
            return Ok(());
        };
        session.child.kill().map_err(|error| error.to_string())
    }
}

fn read_messages(session_id: u64, stdout: impl Read, app: AppHandle) {
    let mut reader = BufReader::new(stdout);
    let mut last_progress_emit = Instant::now() - Duration::from_secs(1);
    loop {
        let mut content_length = None;
        loop {
            let mut header = String::new();
            if reader
                .read_line(&mut header)
                .ok()
                .filter(|read| *read > 0)
                .is_none()
            {
                return;
            }
            let header = header.trim();
            if header.is_empty() {
                break;
            }
            if let Some(value) = header.strip_prefix("Content-Length:") {
                content_length = value.trim().parse::<usize>().ok();
            }
        }
        let Some(length) = content_length else {
            continue;
        };
        let mut body = vec![0u8; length];
        if reader.read_exact(&mut body).is_err() {
            return;
        }
        if let Ok(message) = serde_json::from_slice::<Value>(&body) {
            // JDT floods $/progress / language/status during Maven import.
            // Coalesce noisy notifications so the UI thread is not saturated.
            let method = message.get("method").and_then(|m| m.as_str());
            let is_noisy = matches!(method, Some("$/progress") | Some("language/progressReport"))
                && message.get("id").is_none();
            if is_noisy {
                let now = Instant::now();
                if now.duration_since(last_progress_emit) < Duration::from_millis(100) {
                    continue;
                }
                last_progress_emit = now;
            }
            let _ = app.emit(
                "lsp-message",
                LspMessage {
                    session_id,
                    message,
                },
            );
        }
    }
}

impl Drop for LspService {
    fn drop(&mut self) {
        for (_, mut session) in self.sessions.get_mut().drain() {
            let _ = session.child.kill();
        }
    }
}
