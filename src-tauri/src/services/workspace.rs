use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};

use parking_lot::RwLock;

#[derive(Default)]
pub struct WorkspaceService {
    root: RwLock<Option<PathBuf>>,
    generation: AtomicU64,
}

impl WorkspaceService {
    pub fn set_root(&self, root: Option<PathBuf>) {
        *self.root.write() = root;
        self.invalidate();
    }

    pub fn root(&self) -> Result<PathBuf, String> {
        self.root
            .read()
            .clone()
            .ok_or_else(|| "no workspace open".to_string())
    }

    pub fn invalidate(&self) -> u64 {
        self.generation.fetch_add(1, Ordering::Relaxed) + 1
    }
}
