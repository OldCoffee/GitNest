use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::atomic::AtomicBool;
use std::sync::Arc;

use parking_lot::Mutex;
use rebased_core::{AppSettings, Repository};

pub struct AppState {
    pub repo: Mutex<Option<Repository>>,
    pub settings: Mutex<AppSettings>,
    /// Cancellation flags for in-flight clone operations, keyed by clone id.
    pub clone_cancels: Mutex<HashMap<String, Arc<AtomicBool>>>,
}

impl AppState {
    pub fn new(settings: AppSettings) -> Self {
        Self {
            repo: Mutex::new(None),
            settings: Mutex::new(settings),
            clone_cancels: Mutex::new(HashMap::new()),
        }
    }

    pub fn with_repo<F, T>(&self, f: F) -> Result<T, String>
    where
        F: FnOnce(&Repository) -> rebased_core::Result<T>,
    {
        let guard = self.repo.lock();
        let repo = guard
            .as_ref()
            .ok_or_else(|| "no repository open".to_string())?;
        f(repo).map_err(|e| e.to_string())
    }

    pub fn repo_path(&self) -> Result<PathBuf, String> {
        let guard = self.repo.lock();
        guard
            .as_ref()
            .map(|r| r.path().to_path_buf())
            .ok_or_else(|| "no repository open".to_string())
    }

    /// Snapshot the repo path and git config without keeping the lock held,
    /// so long-running (network) operations don't block other commands.
    pub fn repo_handle(&self) -> Result<(PathBuf, rebased_core::GitCli), String> {
        let guard = self.repo.lock();
        guard
            .as_ref()
            .map(|r| (r.path().to_path_buf(), r.git().clone()))
            .ok_or_else(|| "no repository open".to_string())
    }

    pub fn add_recent_repo(&self, path: &str) {
        let mut settings = self.settings.lock();
        settings.recent_repos.retain(|p| p != path);
        settings.recent_repos.insert(0, path.to_string());
        settings.recent_repos.truncate(20);
    }

    pub fn clear_recent_repos(&self) {
        self.settings.lock().recent_repos.clear();
    }

    pub fn settings_snapshot(&self) -> rebased_core::AppSettings {
        self.settings.lock().clone()
    }
}

pub type SharedState = Arc<AppState>;
