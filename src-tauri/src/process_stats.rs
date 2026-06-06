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
}

impl ProcessStatsTracker {
    pub fn new() -> Self {
        let mut system = System::new_with_specifics(
            RefreshKind::nothing().with_processes(ProcessRefreshKind::everything()),
        );
        let pid = Pid::from_u32(std::process::id());
        system.refresh_processes(ProcessesToUpdate::All, true);
        Self { system, pid }
    }

    pub fn snapshot(&mut self) -> AppProcessStats {
        self.system
            .refresh_processes(ProcessesToUpdate::All, true);
        if let Some(process) = self.system.process(self.pid) {
            AppProcessStats {
                memory_bytes: process.memory(),
                cpu_percent: process.cpu_usage(),
            }
        } else {
            AppProcessStats {
                memory_bytes: 0,
                cpu_percent: 0.0,
            }
        }
    }
}

pub type SharedProcessStatsTracker = Mutex<ProcessStatsTracker>;
