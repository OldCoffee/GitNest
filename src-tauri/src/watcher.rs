use std::collections::HashSet;
use std::sync::Arc;
use std::time::{Duration, Instant};

use notify::{Config, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use serde::Serialize;
use tauri::{AppHandle, Emitter};

const EMIT_DEBOUNCE: Duration = Duration::from_millis(1000);
/// Delay recursive watch until the UI has finished the open transition.
const WATCH_ATTACH_DELAY: Duration = Duration::from_secs(15);
/// Drop the noisy burst of events right after recursive watch attaches.
const WATCH_QUIET_AFTER_ATTACH: Duration = Duration::from_secs(8);

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct WorkspaceChange {
    paths: Vec<String>,
    kind: String,
    generation: u64,
}

fn should_ignore_relative(rel: &str) -> bool {
    let lower = rel.to_ascii_lowercase();
    let parts: Vec<&str> = lower.split('/').collect();
    for part in &parts {
        if matches!(
            *part,
            "target"
                | "build"
                | "out"
                | "bin"
                | "node_modules"
                | ".idea"
                | ".gradle"
                | ".settings"
                | ".git"
                | "dist"
                | "coverage"
        ) {
            return true;
        }
    }
    let base = parts.last().copied().unwrap_or("");
    matches!(
        base,
        ".classpath" | ".project" | ".factorypath" | ".gitignore" | ".ds_store"
    ) || lower.contains("/.git/gitnest/")
        || lower.starts_with(".git/gitnest/")
        || lower.ends_with(".class")
}

pub fn start_repo_watcher(app: AppHandle, state: Arc<crate::state::AppState>) {
    std::thread::spawn(move || {
        let (tx, rx) = std::sync::mpsc::channel();
        let mut watcher = match RecommendedWatcher::new(
            move |res| {
                let _ = tx.send(res);
            },
            Config::default().with_poll_interval(Duration::from_secs(2)),
        ) {
            Ok(w) => w,
            Err(_) => return,
        };

        let mut watched: Option<std::path::PathBuf> = None;
        let mut desired: Option<std::path::PathBuf> = None;
        let mut attach_after: Option<Instant> = None;
        let mut quiet_until: Option<Instant> = None;
        let mut pending_paths = HashSet::new();
        let mut pending_kind = "modify".to_string();
        let mut pending_since: Option<Instant> = None;

        loop {
            match state.repo_path() {
                Ok(path) => {
                    if desired.as_ref() != Some(&path) {
                        desired = Some(path.clone());
                        attach_after = Some(Instant::now() + WATCH_ATTACH_DELAY);
                        quiet_until = None;
                        if let Some(prev) = watched.take() {
                            let _ = watcher.unwatch(&prev);
                        }
                    }
                }
                Err(_) => {
                    desired = None;
                    attach_after = None;
                    quiet_until = None;
                    if let Some(prev) = watched.take() {
                        let _ = watcher.unwatch(&prev);
                    }
                }
            }

            if let Some(path) = desired.as_ref() {
                if attach_after.is_some_and(|when| Instant::now() >= when)
                    && watched.as_ref() != Some(path)
                {
                    if watcher.watch(path, RecursiveMode::Recursive).is_ok() {
                        watched = Some(path.clone());
                        quiet_until = Some(Instant::now() + WATCH_QUIET_AFTER_ATTACH);
                        pending_paths.clear();
                        pending_since = None;
                    }
                    attach_after = None;
                }
            }

            while let Ok(Ok(event)) = rx.recv_timeout(Duration::from_millis(100)) {
                if quiet_until.is_some_and(|until| Instant::now() < until) {
                    continue;
                }
                match event.kind {
                    EventKind::Create(_)
                    | EventKind::Modify(_)
                    | EventKind::Remove(_)
                    | EventKind::Any => {
                        pending_kind = match event.kind {
                            EventKind::Create(_) => "create",
                            EventKind::Remove(_) => "remove",
                            _ => "modify",
                        }
                        .to_string();
                        if let Some(root) = watched.as_ref() {
                            for path in event.paths {
                                if let Ok(relative) = path.strip_prefix(root) {
                                    let rel = relative.to_string_lossy().replace('\\', "/");
                                    if should_ignore_relative(&rel) {
                                        continue;
                                    }
                                    pending_paths.insert(rel);
                                }
                            }
                        }
                        pending_since.get_or_insert_with(Instant::now);
                    }
                    _ => {}
                }
            }

            if pending_since.is_some_and(|started| started.elapsed() >= EMIT_DEBOUNCE) {
                let mut paths: Vec<_> = pending_paths.drain().collect();
                pending_since = None;
                if paths.is_empty() {
                    continue;
                }
                paths.sort();
                let generation = state.workspace.invalidate();
                state.git_service.invalidate();
                let _ = app.emit(
                    "workspace-changed",
                    WorkspaceChange {
                        paths,
                        kind: pending_kind.clone(),
                        generation,
                    },
                );
                // Compatibility event for existing views while they migrate to
                // path-aware invalidation.
                let _ = app.emit("repo-changed", ());
            }
        }
    });
}
