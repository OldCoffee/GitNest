use std::path::{Path, PathBuf};

use parking_lot::Mutex;
use tauri::Manager;

/// Tracks the repository root currently allowed for the asset protocol.
///
/// Tauri's `forbid_directory` permanently denies a path (deny beats allow), so
/// on close we only clear our bookkeeping — we do not forbid. Re-opening the
/// same (or another) repo calls `allow_directory` again (idempotent).
#[derive(Default)]
pub struct AssetScopeTracker {
    current: Mutex<Option<PathBuf>>,
}

impl AssetScopeTracker {
    pub fn allow_repo(&self, app: &tauri::AppHandle, path: &Path) -> Result<(), String> {
        let canonical = path
            .canonicalize()
            .unwrap_or_else(|_| path.to_path_buf());
        app.asset_protocol_scope()
            .allow_directory(&canonical, true)
            .map_err(|e| e.to_string())?;
        *self.current.lock() = Some(canonical);
        Ok(())
    }

    pub fn clear_current(&self) {
        *self.current.lock() = None;
    }

    #[cfg(test)]
    pub fn current(&self) -> Option<PathBuf> {
        self.current.lock().clone()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn clear_current_resets_tracker() {
        let tracker = AssetScopeTracker::default();
        *tracker.current.lock() = Some(PathBuf::from("/tmp/demo"));
        tracker.clear_current();
        assert!(tracker.current().is_none());
    }
}
