use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::sync::Arc;

use parking_lot::Mutex;
use serde::Serialize;
use sysinfo::{Pid, ProcessRefreshKind, ProcessesToUpdate, RefreshKind, System};

#[derive(Debug, Clone, Serialize)]
pub struct AppProcessStats {
    pub memory_bytes: u64,
    pub cpu_percent: f32,
}

pub struct ProcessStatsTracker {
    system: System,
    pid: Pid,
    tracked: Vec<Pid>,
    snapshots_since_discover: u32,
}

impl ProcessStatsTracker {
    pub fn new() -> Self {
        let system = System::new_with_specifics(
            RefreshKind::nothing().with_processes(ProcessRefreshKind::everything()),
        );
        let pid = Pid::from_u32(std::process::id());
        Self {
            system,
            pid,
            tracked: vec![pid],
            snapshots_since_discover: 0,
        }
    }

    pub fn snapshot(&mut self) -> AppProcessStats {
        // Full process-table scans are expensive on macOS — rediscover rarely,
        // then only refresh the tracked app/helper PIDs.
        let rediscover = self.tracked.len() <= 1 || self.snapshots_since_discover >= 8;
        if rediscover {
            self.system.refresh_processes(ProcessesToUpdate::All, true);
            self.tracked = self.discover_tracked();
            self.snapshots_since_discover = 0;
        } else {
            let pids = self.tracked.clone();
            self.system
                .refresh_processes(ProcessesToUpdate::Some(&pids), true);
            self.snapshots_since_discover += 1;
        }

        let mut memory_bytes = 0u64;
        let mut cpu_percent = 0.0f32;
        for pid in &self.tracked {
            if let Some(process) = self.system.process(*pid) {
                memory_bytes = memory_bytes.saturating_add(process.memory());
                cpu_percent += process.cpu_usage();
            }
        }

        AppProcessStats {
            memory_bytes,
            cpu_percent,
        }
    }

    fn discover_tracked(&self) -> Vec<Pid> {
        let mut children: HashMap<u32, Vec<Pid>> = HashMap::new();
        for (pid, process) in self.system.processes() {
            if let Some(parent) = process.parent() {
                children.entry(parent.as_u32()).or_default().push(*pid);
            }
        }

        let mut visited = HashSet::new();
        let mut stack = vec![self.pid];
        while let Some(pid) = stack.pop() {
            if !visited.insert(pid.as_u32()) {
                continue;
            }
            if let Some(kids) = children.get(&pid.as_u32()) {
                stack.extend(kids.iter().copied());
            }
        }

        if let Some(prefix) = self
            .system
            .process(self.pid)
            .and_then(|process| process.exe().map(app_install_prefix))
            .flatten()
        {
            for (pid, process) in self.system.processes() {
                if visited.contains(&pid.as_u32()) {
                    continue;
                }
                if process.exe().is_some_and(|exe| exe.starts_with(&prefix)) {
                    visited.insert(pid.as_u32());
                }
            }
        }

        visited.into_iter().map(Pid::from_u32).collect()
    }
}

/// Prefer the `.app` bundle root on macOS; otherwise the install directory.
fn app_install_prefix(exe: &Path) -> Option<PathBuf> {
    for ancestor in exe.ancestors() {
        if ancestor
            .extension()
            .and_then(|ext| ext.to_str())
            .is_some_and(|ext| ext.eq_ignore_ascii_case("app"))
        {
            return Some(ancestor.to_path_buf());
        }
    }
    exe.parent().map(Path::to_path_buf)
}

pub type SharedProcessStatsTracker = Arc<Mutex<ProcessStatsTracker>>;
