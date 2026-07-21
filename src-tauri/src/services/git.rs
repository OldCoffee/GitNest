use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};

use parking_lot::{Mutex, RwLock};
use rebased_core::GitCli;

/// Coordinates Git access without exposing the repository object lock to long
/// running commands. Read-only commands take a cloned handle; mutating commands
/// can use `mutation_guard` to avoid overlapping checkout/merge/rebase actions.
#[derive(Default)]
pub struct GitService {
    handle: RwLock<Option<(PathBuf, GitCli)>>,
    mutation_lock: Mutex<()>,
    cache_generation: AtomicU64,
}

impl GitService {
    pub fn set_handle(&self, handle: Option<(PathBuf, GitCli)>) {
        *self.handle.write() = handle;
        self.invalidate();
    }

    pub fn handle(&self) -> Result<(PathBuf, GitCli), String> {
        self.handle
            .read()
            .clone()
            .ok_or_else(|| "no repository open".to_string())
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
