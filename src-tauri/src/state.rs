use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::atomic::AtomicBool;
use std::sync::Arc;

use crate::services::{GitService, LspService, TaskScheduler, TerminalService, WorkspaceService};
use parking_lot::Mutex;
use rebased_core::{AppSettings, Repository};

pub struct AppState {
    pub repo: Mutex<Option<Repository>>,
    pub settings: Mutex<AppSettings>,
    /// Cancellation flags for in-flight clone operations, keyed by clone id.
    pub clone_cancels: Mutex<HashMap<String, Arc<AtomicBool>>>,
    pub tasks: Arc<TaskScheduler>,
    pub workspace: Arc<WorkspaceService>,
    pub git_service: Arc<GitService>,
    pub terminals: Arc<TerminalService>,
    pub lsp: Arc<LspService>,
}

impl AppState {
    pub fn new(settings: AppSettings) -> Self {
        Self {
            repo: Mutex::new(None),
            settings: Mutex::new(settings),
            clone_cancels: Mutex::new(HashMap::new()),
            tasks: Arc::new(TaskScheduler::default()),
            workspace: Arc::new(WorkspaceService::default()),
            git_service: Arc::new(GitService::default()),
            terminals: Arc::new(TerminalService::default()),
            lsp: Arc::new(LspService::default()),
        }
    }

    pub fn repo_path(&self) -> Result<PathBuf, String> {
        let guard = self.repo.lock();
        guard
            .as_ref()
            .map(|r| r.path().to_path_buf())
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
