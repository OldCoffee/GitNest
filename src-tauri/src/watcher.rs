use std::sync::Arc;
use std::time::{Duration, Instant};

use notify::{Config, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use tauri::{AppHandle, Emitter};

const EMIT_DEBOUNCE: Duration = Duration::from_millis(400);

pub fn start_repo_watcher(app: AppHandle, state: Arc<crate::state::AppState>) {
    std::thread::spawn(move || {
        let (tx, rx) = std::sync::mpsc::channel();
        let mut watcher = match RecommendedWatcher::new(
            move |res| {
                let _ = tx.send(res);
            },
            Config::default().with_poll_interval(Duration::from_secs(1)),
        ) {
            Ok(w) => w,
            Err(_) => return,
        };

        let mut watched: Option<std::path::PathBuf> = None;
        let mut last_emit = Instant::now() - EMIT_DEBOUNCE;

        loop {
            match state.repo_path() {
                Ok(path) => {
                    if watched.as_ref() != Some(&path) {
                        if let Some(prev) = watched.take() {
                            let _ = watcher.unwatch(&prev);
                        }
                        if watcher.watch(&path, RecursiveMode::Recursive).is_ok() {
                            watched = Some(path);
                        }
                    }
                }
                Err(_) => {
                    if let Some(prev) = watched.take() {
                        let _ = watcher.unwatch(&prev);
                    }
                }
            }

            while let Ok(Ok(event)) = rx.recv_timeout(Duration::from_millis(500)) {
                match event.kind {
                    EventKind::Create(_)
                    | EventKind::Modify(_)
                    | EventKind::Remove(_)
                    | EventKind::Any => {
                        let now = Instant::now();
                        if now.duration_since(last_emit) >= EMIT_DEBOUNCE {
                            let _ = app.emit("repo-changed", ());
                            last_emit = now;
                        }
                    }
                    _ => {}
                }
            }
        }
    });
}
