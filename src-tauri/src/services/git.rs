use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};

use parking_lot::{Mutex, RwLock};
use rebased_core::GitCli;

/// Coordinates Git access without exposing the repository object lock to long
/// running commands. Multiple roots may be registered; reads/mutations use the
/// current active handle. Mutating commands share one global `mutation_lock`.
#[derive(Default)]
pub struct GitService {
    handles: RwLock<HashMap<PathBuf, GitCli>>,
    active: RwLock<Option<PathBuf>>,
    mutation_lock: Mutex<()>,
    cache_generation: AtomicU64,
}

fn canonicalize_key(path: &Path) -> PathBuf {
    path.canonicalize().unwrap_or_else(|_| path.to_path_buf())
}

impl GitService {
    /// Compatibility: replace all handles with a single active root, or clear.
    pub fn set_handle(&self, handle: Option<(PathBuf, GitCli)>) {
        match handle {
            Some((path, git)) => {
                let key = canonicalize_key(&path);
                let mut handles = self.handles.write();
                handles.clear();
                handles.insert(key.clone(), git);
                *self.active.write() = Some(key);
            }
            None => {
                self.clear();
                return;
            }
        }
        self.invalidate();
    }

    pub fn clear(&self) {
        self.handles.write().clear();
        *self.active.write() = None;
        self.invalidate();
    }

    pub fn register(&self, path: &Path, git: GitCli) {
        let key = canonicalize_key(path);
        self.handles.write().insert(key, git);
        self.invalidate();
    }

    pub fn unregister(&self, path: &Path) {
        let key = canonicalize_key(path);
        self.handles.write().remove(&key);
        let mut active = self.active.write();
        if active.as_ref() == Some(&key) {
            *active = None;
        }
        self.invalidate();
    }

    pub fn set_active(&self, path: &Path) -> Result<(), String> {
        let key = canonicalize_key(path);
        if !self.handles.read().contains_key(&key) {
            return Err("git root is not registered".into());
        }
        *self.active.write() = Some(key);
        self.invalidate();
        Ok(())
    }

    pub fn active_path(&self) -> Option<PathBuf> {
        self.active.read().clone()
    }

    pub fn is_registered(&self, path: &Path) -> bool {
        let key = canonicalize_key(path);
        self.handles.read().contains_key(&key)
    }

    pub fn handle(&self) -> Result<(PathBuf, GitCli), String> {
        let active = self
            .active
            .read()
            .clone()
            .ok_or_else(|| "no repository open".to_string())?;
        self.handle_for(&active)
    }

    /// Return the registered handle for a workspace git root.
    pub fn handle_for(&self, path: &Path) -> Result<(PathBuf, GitCli), String> {
        let key = canonicalize_key(path);
        let git = self
            .handles
            .read()
            .get(&key)
            .cloned()
            .ok_or_else(|| "git root is not registered".to_string())?;
        Ok((key, git))
    }

    pub fn with_mutation<T>(
        &self,
        operation: impl FnOnce(PathBuf, GitCli) -> Result<T, String>,
    ) -> Result<T, String> {
        let _guard = self.mutation_lock.lock();
        let (path, git) = self.handle()?;
        let result = operation(path, git);
        if result.is_ok() {
            self.invalidate();
        }
        result
    }

    pub fn invalidate(&self) -> u64 {
        self.cache_generation.fetch_add(1, Ordering::Relaxed) + 1
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn register_and_activate_switches_handle() {
        let svc = GitService::default();
        let a = PathBuf::from("/tmp/gitnest-a");
        let b = PathBuf::from("/tmp/gitnest-b");
        svc.register(&a, GitCli::new("git"));
        svc.register(&b, GitCli::new("git"));
        svc.set_active(&a).unwrap();
        assert!(svc.handle().unwrap().0.ends_with("gitnest-a") || svc.handle().unwrap().0 == a);
        svc.set_active(&b).unwrap();
        let (path, _) = svc.handle().unwrap();
        assert!(path.ends_with("gitnest-b") || path == b);
    }

    #[test]
    fn set_handle_none_clears() {
        let svc = GitService::default();
        svc.register(Path::new("/tmp/x"), GitCli::new("git"));
        svc.set_active(Path::new("/tmp/x")).unwrap();
        svc.set_handle(None);
        assert!(svc.handle().is_err());
        assert!(svc.active_path().is_none());
    }

    #[test]
    fn unregister_clears_active_when_needed() {
        let svc = GitService::default();
        let path = PathBuf::from("/tmp/gitnest-only");
        svc.register(&path, GitCli::new("git"));
        svc.set_active(&path).unwrap();
        svc.unregister(&path);
        assert!(svc.handle().is_err());
    }

    #[test]
    fn handle_for_reads_non_active_root() {
        let svc = GitService::default();
        let a = PathBuf::from("/tmp/gitnest-a");
        let b = PathBuf::from("/tmp/gitnest-b");
        svc.register(&a, GitCli::new("git"));
        svc.register(&b, GitCli::new("git"));
        svc.set_active(&a).unwrap();
        let (path, _) = svc.handle_for(&b).unwrap();
        assert!(path.ends_with("gitnest-b") || path == b);
        assert!(svc.handle().unwrap().0.ends_with("gitnest-a") || svc.handle().unwrap().0 == a);
    }
}
