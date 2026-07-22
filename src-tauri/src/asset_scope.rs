use std::collections::HashSet;
use std::path::{Path, PathBuf};

use parking_lot::Mutex;
use tauri::Manager;

/// Tracks workspace roots currently allowed for the asset protocol.
///
/// Tauri's `forbid_directory` permanently denies a path (deny beats allow), so
/// on close we only clear our bookkeeping — we do not forbid. Re-opening the
/// same (or another) path calls `allow_directory` again (idempotent).
#[derive(Default)]
pub struct AssetScopeTracker {
    current: Mutex<HashSet<PathBuf>>,
}

impl AssetScopeTracker {
    pub fn allow_repo(&self, app: &tauri::AppHandle, path: &Path) -> Result<(), String> {
        self.allow_path(app, path)
    }

    pub fn allow_path(&self, app: &tauri::AppHandle, path: &Path) -> Result<(), String> {
        let canonical = path.canonicalize().unwrap_or_else(|_| path.to_path_buf());
        app.asset_protocol_scope()
            .allow_directory(&canonical, true)
            .map_err(|e| e.to_string())?;
        self.current.lock().insert(canonical);
        Ok(())
    }

    pub fn clear_current(&self) {
        self.current.lock().clear();
    }

    #[cfg(test)]
    pub fn current(&self) -> HashSet<PathBuf> {
        self.current.lock().clone()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn clear_current_resets_tracker() {
        let tracker = AssetScopeTracker::default();
        tracker.current.lock().insert(PathBuf::from("/tmp/demo"));
        tracker.clear_current();
        assert!(tracker.current().is_empty());
    }
}
