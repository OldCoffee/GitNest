use std::collections::HashSet;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::{Duration, Instant};

use notify::{Config, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use serde::Serialize;
use tauri::{AppHandle, Emitter};

const EMIT_DEBOUNCE: Duration = Duration::from_millis(1000);
/// Brief settle after recursive watch attaches (drops OS create-storm only).
const WATCH_ATTACH_SETTLE: Duration = Duration::from_millis(300);

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

/// Whether a watcher event root is still the active workspace (generation-aware).
fn is_active_watch(watched: Option<&PathBuf>, current: Result<PathBuf, String>) -> bool {
    match (watched, current) {
        (Some(w), Ok(c)) => w == &c,
        _ => false,
    }
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

        let mut watched: Option<PathBuf> = None;
        let mut desired: Option<PathBuf> = None;
        let mut quiet_until: Option<Instant> = None;
        let mut pending_paths = HashSet::new();
        let mut pending_kind = "modify".to_string();
        let mut pending_since: Option<Instant> = None;

        loop {
            match state.repo_path() {
                Ok(path) => {
                    if desired.as_ref() != Some(&path) {
                        desired = Some(path.clone());
                        pending_paths.clear();
                        pending_since = None;
                        quiet_until = None;
                        if let Some(prev) = watched.take() {
                            let _ = watcher.unwatch(&prev);
                        }
                        // Attach immediately — no multi-second blind window.
                        if watcher.watch(&path, RecursiveMode::Recursive).is_ok() {
                            watched = Some(path);
                            quiet_until = Some(Instant::now() + WATCH_ATTACH_SETTLE);
                        }
                    }
                }
                Err(_) => {
                    desired = None;
                    quiet_until = None;
                    pending_paths.clear();
                    pending_since = None;
                    if let Some(prev) = watched.take() {
                        let _ = watcher.unwatch(&prev);
                    }
                }
            }

            while let Ok(Ok(event)) = rx.recv_timeout(Duration::from_millis(100)) {
                // Drop events from a previous workspace after close/switch.
                if !is_active_watch(watched.as_ref(), state.repo_path()) {
                    continue;
                }
                // Drop attach-storm noise only; keep real edits after settle.
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
                if !is_active_watch(watched.as_ref(), state.repo_path()) {
                    pending_paths.clear();
                    pending_since = None;
                    continue;
                }
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

#[cfg(test)]
mod tests {
    use super::{is_active_watch, should_ignore_relative};
    use std::path::PathBuf;

    #[test]
    fn ignores_heavy_and_vcs_noise() {
        assert!(should_ignore_relative("node_modules/pkg/index.js"));
        assert!(should_ignore_relative("target/debug/foo"));
        assert!(should_ignore_relative(".git/HEAD"));
        assert!(should_ignore_relative("src/App.class"));
        assert!(!should_ignore_relative("src/App.java"));
        assert!(!should_ignore_relative("README.md"));
    }

    #[test]
    fn active_watch_requires_matching_root() {
        let root = PathBuf::from("/tmp/repo-a");
        assert!(is_active_watch(
            Some(&root),
            Ok(PathBuf::from("/tmp/repo-a"))
        ));
        assert!(!is_active_watch(
            Some(&root),
            Ok(PathBuf::from("/tmp/repo-b"))
        ));
        assert!(!is_active_watch(
            Some(&root),
            Err("no repository open".into())
        ));
        assert!(!is_active_watch(None, Ok(root)));
    }
}
