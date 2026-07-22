use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
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
    root_path: String,
    paths: Vec<String>,
    kind: String,
    generation: u64,
}

struct PendingBucket {
    paths: HashSet<String>,
    kind: String,
    since: Option<Instant>,
}

impl Default for PendingBucket {
    fn default() -> Self {
        Self {
            paths: HashSet::new(),
            kind: "modify".to_string(),
            since: None,
        }
    }
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

fn normalize_root_key(path: &Path) -> PathBuf {
    path.canonicalize().unwrap_or_else(|_| path.to_path_buf())
}

fn root_display(path: &Path) -> String {
    path.to_string_lossy().replace('\\', "/")
}

/// Sync watched set to desired registered git roots. Returns roots that were newly attached.
fn sync_watched_roots(
    watcher: &mut RecommendedWatcher,
    watched: &mut HashSet<PathBuf>,
    desired: &HashSet<PathBuf>,
) -> Vec<PathBuf> {
    let to_remove: Vec<PathBuf> = watched.difference(desired).cloned().collect();
    for path in to_remove {
        let _ = watcher.unwatch(&path);
        watched.remove(&path);
    }

    let mut attached = Vec::new();
    let to_add: Vec<PathBuf> = desired.difference(watched).cloned().collect();
    for path in to_add {
        if watcher.watch(&path, RecursiveMode::Recursive).is_ok() {
            watched.insert(path.clone());
            attached.push(path);
        }
    }
    attached
}

/// Find the registered watch root that owns an absolute event path.
fn find_event_root<'a>(watched: &'a HashSet<PathBuf>, path: &Path) -> Option<&'a PathBuf> {
    watched
        .iter()
        .filter(|root| path.starts_with(root.as_path()))
        .max_by_key(|root| root.as_os_str().len())
}

/// Whether a watch root is still among registered git roots.
fn is_registered_watch(root: &Path, registered: &HashSet<PathBuf>) -> bool {
    let key = normalize_root_key(root);
    registered.contains(&key) || registered.iter().any(|r| r == root)
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

        let mut watched: HashSet<PathBuf> = HashSet::new();
        let mut quiet_until: HashMap<PathBuf, Instant> = HashMap::new();
        let mut pending: HashMap<PathBuf, PendingBucket> = HashMap::new();

        loop {
            let desired: HashSet<PathBuf> = state
                .git_service
                .registered_paths()
                .into_iter()
                .map(|p| normalize_root_key(&p))
                .collect();

            let attached = sync_watched_roots(&mut watcher, &mut watched, &desired);
            for path in &attached {
                quiet_until.insert(path.clone(), Instant::now() + WATCH_ATTACH_SETTLE);
                pending.remove(path);
            }
            // Drop pending/quiet for unwatched roots.
            quiet_until.retain(|root, _| watched.contains(root));
            pending.retain(|root, _| watched.contains(root));

            while let Ok(Ok(event)) = rx.recv_timeout(Duration::from_millis(100)) {
                match event.kind {
                    EventKind::Create(_)
                    | EventKind::Modify(_)
                    | EventKind::Remove(_)
                    | EventKind::Any => {
                        let kind = match event.kind {
                            EventKind::Create(_) => "create",
                            EventKind::Remove(_) => "remove",
                            _ => "modify",
                        };
                        for path in event.paths {
                            let Some(root) = find_event_root(&watched, &path).cloned() else {
                                continue;
                            };
                            if !is_registered_watch(&root, &desired) {
                                continue;
                            }
                            if quiet_until
                                .get(&root)
                                .is_some_and(|until| Instant::now() < *until)
                            {
                                continue;
                            }
                            let Ok(relative) = path.strip_prefix(&root) else {
                                continue;
                            };
                            let rel = relative.to_string_lossy().replace('\\', "/");
                            if should_ignore_relative(&rel) {
                                continue;
                            }
                            let bucket = pending.entry(root).or_default();
                            bucket.kind = kind.to_string();
                            bucket.paths.insert(rel);
                            bucket.since.get_or_insert_with(Instant::now);
                        }
                    }
                    _ => {}
                }
            }

            let registered_now: HashSet<PathBuf> = state
                .git_service
                .registered_paths()
                .into_iter()
                .map(|p| normalize_root_key(&p))
                .collect();

            let ready_roots: Vec<PathBuf> = pending
                .iter()
                .filter(|(_, bucket)| {
                    bucket
                        .since
                        .is_some_and(|started| started.elapsed() >= EMIT_DEBOUNCE)
                        && !bucket.paths.is_empty()
                })
                .map(|(root, _)| root.clone())
                .collect();

            for root in ready_roots {
                if !is_registered_watch(&root, &registered_now) {
                    pending.remove(&root);
                    continue;
                }
                let Some(mut bucket) = pending.remove(&root) else {
                    continue;
                };
                bucket.since = None;
                let mut paths: Vec<_> = bucket.paths.drain().collect();
                if paths.is_empty() {
                    continue;
                }
                paths.sort();
                let generation = state.workspace.invalidate();
                state.git_service.invalidate();
                let _ = app.emit(
                    "workspace-changed",
                    WorkspaceChange {
                        root_path: root_display(&root),
                        paths,
                        kind: bucket.kind,
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
    use super::{
        find_event_root, is_registered_watch, should_ignore_relative, sync_watched_roots,
    };
    use std::collections::HashSet;
    use std::path::PathBuf;
    use std::time::Duration;

    use notify::{Config, RecommendedWatcher, Watcher};

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
    fn registered_watch_requires_membership() {
        let root = PathBuf::from("/tmp/repo-a");
        let mut registered = HashSet::new();
        registered.insert(root.clone());
        assert!(is_registered_watch(&root, &registered));
        assert!(!is_registered_watch(
            &PathBuf::from("/tmp/repo-b"),
            &registered
        ));
    }

    #[test]
    fn find_event_root_picks_longest_prefix() {
        let mut watched = HashSet::new();
        watched.insert(PathBuf::from("/tmp/work"));
        watched.insert(PathBuf::from("/tmp/work/nested"));
        let path = PathBuf::from("/tmp/work/nested/src/a.ts");
        let root = find_event_root(&watched, &path).unwrap();
        assert_eq!(root, &PathBuf::from("/tmp/work/nested"));
    }

    #[test]
    fn sync_watched_roots_adds_and_removes() {
        let (tx, _rx) = std::sync::mpsc::channel();
        let mut watcher = RecommendedWatcher::new(
            move |res| {
                let _ = tx.send(res);
            },
            Config::default().with_poll_interval(Duration::from_secs(2)),
        )
        .expect("watcher");

        let tmp_a = tempfile::tempdir().expect("tmp a");
        let tmp_b = tempfile::tempdir().expect("tmp b");
        let a = tmp_a.path().to_path_buf();
        let b = tmp_b.path().to_path_buf();

        let mut watched = HashSet::new();
        let mut desired = HashSet::new();
        desired.insert(a.clone());
        desired.insert(b.clone());

        let attached = sync_watched_roots(&mut watcher, &mut watched, &desired);
        assert_eq!(attached.len(), 2);
        assert!(watched.contains(&a));
        assert!(watched.contains(&b));

        desired.remove(&b);
        let attached = sync_watched_roots(&mut watcher, &mut watched, &desired);
        assert!(attached.is_empty());
        assert!(watched.contains(&a));
        assert!(!watched.contains(&b));

        let _ = watcher.unwatch(&a);
    }
}
