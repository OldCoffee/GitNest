use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};

use parking_lot::RwLock;

#[derive(Default)]
pub struct WorkspaceService {
    roots: RwLock<Vec<PathBuf>>,
    generation: AtomicU64,
}

fn canonicalize_dir(path: &Path) -> Result<PathBuf, String> {
    let canonical = path
        .canonicalize()
        .map_err(|e| format!("invalid path: {e}"))?;
    if !canonical.is_dir() {
        return Err("path is not a directory".into());
    }
    Ok(canonical)
}

fn is_nested(a: &Path, b: &Path) -> bool {
    a.starts_with(b) || b.starts_with(a)
}

impl WorkspaceService {
    /// Compatibility: set a single primary root (or clear all).
    pub fn set_root(&self, root: Option<PathBuf>) {
        match root {
            Some(path) => {
                let path = path.canonicalize().unwrap_or(path);
                *self.roots.write() = vec![path];
            }
            None => {
                self.roots.write().clear();
            }
        }
        self.invalidate();
    }

    pub fn set_roots(&self, roots: Vec<PathBuf>) {
        let normalized: Vec<PathBuf> = roots
            .into_iter()
            .map(|path| path.canonicalize().unwrap_or(path))
            .collect();
        *self.roots.write() = normalized;
        self.invalidate();
    }

    pub fn roots(&self) -> Vec<PathBuf> {
        self.roots.read().clone()
    }

    /// Primary / first workspace root (typically the active git repo).
    pub fn root(&self) -> Result<PathBuf, String> {
        self.roots
            .read()
            .first()
            .cloned()
            .ok_or_else(|| "no workspace open".to_string())
    }

    pub fn add_root(&self, path: &Path) -> Result<Vec<PathBuf>, String> {
        let canonical = canonicalize_dir(path)?;
        {
            let mut roots = self.roots.write();
            for existing in roots.iter() {
                if existing == &canonical {
                    return Ok(roots.clone());
                }
                if is_nested(&canonical, existing) {
                    return Err(
                        "workspace folders cannot nest (folder is inside or contains an existing root)"
                            .into(),
                    );
                }
            }
            roots.push(canonical);
        }
        self.invalidate();
        Ok(self.roots())
    }

    pub fn remove_root(&self, path: &Path) -> Result<Vec<PathBuf>, String> {
        let canonical = path.canonicalize().unwrap_or_else(|_| path.to_path_buf());
        {
            let mut roots = self.roots.write();
            let Some(index) = roots.iter().position(|root| root == &canonical) else {
                return Err("workspace folder not found".into());
            };
            if index == 0 {
                return Err(
                    "cannot remove the active git root; close or switch the repository first"
                        .into(),
                );
            }
            roots.remove(index);
        }
        self.invalidate();
        Ok(self.roots())
    }

    pub fn contains_root(&self, path: &Path) -> bool {
        let canonical = path.canonicalize().unwrap_or_else(|_| path.to_path_buf());
        self.roots.read().iter().any(|root| root == &canonical)
    }

    /// Move an existing root to index 0 (active git root).
    pub fn promote_to_front(&self, path: &Path) -> Result<Vec<PathBuf>, String> {
        let canonical = path.canonicalize().unwrap_or_else(|_| path.to_path_buf());
        {
            let mut roots = self.roots.write();
            let Some(index) = roots.iter().position(|root| root == &canonical) else {
                return Err("workspace folder not found".into());
            };
            if index != 0 {
                let item = roots.remove(index);
                roots.insert(0, item);
            }
        }
        self.invalidate();
        Ok(self.roots())
    }

    pub fn invalidate(&self) -> u64 {
        self.generation.fetch_add(1, Ordering::Relaxed) + 1
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn set_root_and_clear() {
        let ws = WorkspaceService::default();
        let dir = tempdir().unwrap();
        ws.set_root(Some(dir.path().to_path_buf()));
        assert_eq!(ws.roots().len(), 1);
        ws.set_root(None);
        assert!(ws.roots().is_empty());
        assert!(ws.root().is_err());
    }

    #[test]
    fn add_root_rejects_nested() {
        let ws = WorkspaceService::default();
        let dir = tempdir().unwrap();
        let parent = dir.path();
        let child = parent.join("child");
        fs::create_dir_all(&child).unwrap();

        ws.set_root(Some(parent.to_path_buf()));
        let err = ws.add_root(&child).unwrap_err();
        assert!(err.contains("nest"), "{err}");
    }

    #[test]
    fn add_and_remove_extra_root() {
        let ws = WorkspaceService::default();
        let a = tempdir().unwrap();
        let b = tempdir().unwrap();
        ws.set_root(Some(a.path().to_path_buf()));
        let roots = ws.add_root(b.path()).unwrap();
        assert_eq!(roots.len(), 2);
        let removed = ws.remove_root(b.path()).unwrap();
        assert_eq!(removed.len(), 1);
    }

    #[test]
    fn cannot_remove_primary_root() {
        let ws = WorkspaceService::default();
        let a = tempdir().unwrap();
        ws.set_root(Some(a.path().to_path_buf()));
        let err = ws.remove_root(a.path()).unwrap_err();
        assert!(err.contains("active git root"), "{err}");
    }

    #[test]
    fn promote_to_front_reorders() {
        let ws = WorkspaceService::default();
        let a = tempdir().unwrap();
        let b = tempdir().unwrap();
        ws.set_root(Some(a.path().to_path_buf()));
        ws.add_root(b.path()).unwrap();
        let roots = ws.promote_to_front(b.path()).unwrap();
        assert_eq!(roots[0], b.path().canonicalize().unwrap());
        assert_eq!(roots[1], a.path().canonicalize().unwrap());
    }
}
