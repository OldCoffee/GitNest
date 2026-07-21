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

/// Testable session-id / map bookkeeping shared by [`TerminalService`].
pub(crate) struct SessionRegistry<T> {
    next_id: AtomicU64,
    sessions: Mutex<HashMap<u64, T>>,
}

impl<T> Default for SessionRegistry<T> {
    fn default() -> Self {
        Self {
            next_id: AtomicU64::new(0),
            sessions: Mutex::new(HashMap::new()),
        }
    }
}

impl<T> SessionRegistry<T> {
    pub fn alloc_id(&self) -> u64 {
        self.next_id.fetch_add(1, Ordering::Relaxed) + 1
    }

    pub fn insert(&self, id: u64, session: T) {
        self.sessions.lock().insert(id, session);
    }

    pub fn remove(&self, id: u64) -> Option<T> {
        self.sessions.lock().remove(&id)
    }

    pub fn get_mut_with<R>(&self, id: u64, f: impl FnOnce(&mut T) -> R) -> Option<R> {
        self.sessions.lock().get_mut(&id).map(f)
    }

    pub fn get_with<R>(&self, id: u64, f: impl FnOnce(&T) -> R) -> Option<R> {
        self.sessions.lock().get(&id).map(f)
    }

    pub fn drain_all(&self) -> Vec<(u64, T)> {
        self.sessions.lock().drain().collect()
    }

    #[cfg(test)]
    pub fn len(&self) -> usize {
        self.sessions.lock().len()
    }

    #[cfg(test)]
    pub fn ids(&self) -> Vec<u64> {
        let mut ids: Vec<u64> = self.sessions.lock().keys().copied().collect();
        ids.sort_unstable();
        ids
    }
}

#[derive(Default)]
pub struct TerminalService {
    sessions: SessionRegistry<TerminalSession>,
}

fn terminate_child(mut child: Box<dyn Child + Send + Sync>) {
    let _ = child.kill();
    let _ = child.wait();
}

fn terminate_session(session: TerminalSession) {
    // Close PTY ends first so the shell sees hangup, then reap the child.
    drop(session.writer);
    drop(session.master);
    terminate_child(session.child);
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

        let mut reader = match pair.master.try_clone_reader() {
            Ok(reader) => reader,
            Err(error) => {
                terminate_child(child);
                return Err(error.to_string());
            }
        };
        let writer = match pair.master.take_writer() {
            Ok(writer) => writer,
            Err(error) => {
                terminate_child(child);
                return Err(error.to_string());
            }
        };
        let session_id = self.sessions.alloc_id();

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

        self.sessions.insert(
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
        self.sessions
            .get_mut_with(session_id, |session| {
                session
                    .writer
                    .write_all(data)
                    .and_then(|_| session.writer.flush())
                    .map_err(|error| error.to_string())
            })
            .ok_or_else(|| "terminal session not found".to_string())?
    }

    pub fn resize(&self, session_id: u64, cols: u16, rows: u16) -> Result<(), String> {
        self.sessions
            .get_with(session_id, |session| {
                session
                    .master
                    .resize(PtySize {
                        rows,
                        cols,
                        pixel_width: 0,
                        pixel_height: 0,
                    })
                    .map_err(|error| error.to_string())
            })
            .ok_or_else(|| "terminal session not found".to_string())?
    }

    pub fn close(&self, session_id: u64) -> Result<(), String> {
        let Some(session) = self.sessions.remove(session_id) else {
            return Ok(());
        };
        terminate_session(session);
        Ok(())
    }

    /// Kill and reap every tracked PTY session. Safe to call when closing a
    /// repository or tearing down the workspace even if the UI already closed
    /// individual tabs. Returns how many sessions were closed.
    pub fn close_all(&self) -> usize {
        let drained = self.sessions.drain_all();
        let count = drained.len();
        for (_, session) in drained {
            terminate_session(session);
        }
        count
    }

    #[cfg(test)]
    pub fn session_count(&self) -> usize {
        self.sessions.len()
    }

    #[cfg(test)]
    pub fn session_ids(&self) -> Vec<u64> {
        self.sessions.ids()
    }
}

impl Drop for TerminalService {
    fn drop(&mut self) {
        self.close_all();
    }
}

#[cfg(test)]
mod tests {
    use super::{SessionRegistry, TerminalService};

    #[test]
    fn alloc_id_starts_at_one_and_increments() {
        let registry = SessionRegistry::<()>::default();
        assert_eq!(registry.alloc_id(), 1);
        assert_eq!(registry.alloc_id(), 2);
        assert_eq!(registry.alloc_id(), 3);
    }

    #[test]
    fn insert_remove_updates_map() {
        let registry = SessionRegistry::default();
        let id = registry.alloc_id();
        registry.insert(id, "shell");
        assert_eq!(registry.len(), 1);
        assert_eq!(registry.ids(), vec![id]);
        assert_eq!(registry.remove(id), Some("shell"));
        assert_eq!(registry.len(), 0);
        assert!(registry.remove(id).is_none());
    }

    #[test]
    fn drain_all_clears_every_session() {
        let registry = SessionRegistry::default();
        let a = registry.alloc_id();
        let b = registry.alloc_id();
        registry.insert(a, "a");
        registry.insert(b, "b");
        let mut drained = registry.drain_all();
        drained.sort_by_key(|(id, _)| *id);
        assert_eq!(drained, vec![(a, "a"), (b, "b")]);
        assert_eq!(registry.len(), 0);
        assert!(registry.ids().is_empty());
    }

    #[test]
    fn remove_missing_is_noop() {
        let registry = SessionRegistry::<u32>::default();
        assert!(registry.remove(42).is_none());
        assert_eq!(registry.len(), 0);
    }

    #[test]
    fn terminal_service_close_all_on_empty_returns_zero() {
        let service = TerminalService::default();
        assert_eq!(service.session_count(), 0);
        assert_eq!(service.close_all(), 0);
        assert!(service.session_ids().is_empty());
    }
}
