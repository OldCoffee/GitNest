use std::collections::HashMap;
use std::io::{Read, Write};
use std::path::Path;
use std::sync::atomic::{AtomicU64, Ordering};

use parking_lot::Mutex;
use portable_pty::{native_pty_system, Child, CommandBuilder, MasterPty, PtySize};
use serde::Serialize;
use tauri::{AppHandle, Emitter};

struct TerminalSession {
    master: Box<dyn MasterPty + Send>,
    child: Box<dyn Child + Send + Sync>,
    writer: Box<dyn Write + Send>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalOutput {
    pub session_id: u64,
    pub data: Vec<u8>,
}

#[derive(Default)]
pub struct TerminalService {
    next_id: AtomicU64,
    sessions: Mutex<HashMap<u64, TerminalSession>>,
}

impl TerminalService {
    pub fn create(
        &self,
        app: AppHandle,
        shell: &str,
        cwd: &Path,
        cols: u16,
        rows: u16,
    ) -> Result<u64, String> {
        let pair = native_pty_system()
            .openpty(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|error| error.to_string())?;
        let mut command = CommandBuilder::new(shell);
        command.cwd(cwd);
        if cfg!(unix) {
            command.arg("-l");
        }
        let child = pair
            .slave
            .spawn_command(command)
            .map_err(|error| error.to_string())?;
        drop(pair.slave);

        let mut reader = pair
            .master
            .try_clone_reader()
            .map_err(|error| error.to_string())?;
        let writer = pair
            .master
            .take_writer()
            .map_err(|error| error.to_string())?;
        let session_id = self.next_id.fetch_add(1, Ordering::Relaxed) + 1;

        std::thread::spawn(move || {
            let mut buffer = [0u8; 8 * 1024];
            loop {
                match reader.read(&mut buffer) {
                    Ok(0) | Err(_) => break,
                    Ok(read) => {
                        let _ = app.emit(
                            "terminal-output",
                            TerminalOutput {
                                session_id,
                                data: buffer[..read].to_vec(),
                            },
                        );
                    }
                }
            }
            let _ = app.emit("terminal-exit", session_id);
        });

        self.sessions.lock().insert(
            session_id,
            TerminalSession {
                master: pair.master,
                child,
                writer,
            },
        );
        Ok(session_id)
    }

    pub fn write(&self, session_id: u64, data: &[u8]) -> Result<(), String> {
        let mut sessions = self.sessions.lock();
        let session = sessions
            .get_mut(&session_id)
            .ok_or_else(|| "terminal session not found".to_string())?;
        session
            .writer
            .write_all(data)
            .map_err(|error| error.to_string())?;
        session.writer.flush().map_err(|error| error.to_string())
    }

    pub fn resize(&self, session_id: u64, cols: u16, rows: u16) -> Result<(), String> {
        let sessions = self.sessions.lock();
        let session = sessions
            .get(&session_id)
            .ok_or_else(|| "terminal session not found".to_string())?;
        session
            .master
            .resize(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|error| error.to_string())
    }

    pub fn close(&self, session_id: u64) -> Result<(), String> {
        let Some(mut session) = self.sessions.lock().remove(&session_id) else {
            return Ok(());
        };
        session.child.kill().map_err(|error| error.to_string())
    }
}

impl Drop for TerminalService {
    fn drop(&mut self) {
        for (_, mut session) in self.sessions.get_mut().drain() {
            let _ = session.child.kill();
        }
    }
}
