use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

use parking_lot::Mutex;
use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct TaskInfo {
    pub id: u64,
    pub label: String,
    pub state: String,
    pub started_ms: u64,
    pub finished_ms: Option<u64>,
    pub error: Option<String>,
}

struct TaskRecord {
    info: TaskInfo,
    canceled: Arc<AtomicBool>,
}

#[derive(Default)]
pub struct TaskScheduler {
    next_id: AtomicU64,
    tasks: Mutex<HashMap<u64, TaskRecord>>,
}

impl TaskScheduler {
    pub fn start(&self, label: impl Into<String>) -> (u64, Arc<AtomicBool>) {
        let id = self.next_id.fetch_add(1, Ordering::Relaxed) + 1;
        let canceled = Arc::new(AtomicBool::new(false));
        self.tasks.lock().insert(
            id,
            TaskRecord {
                info: TaskInfo {
                    id,
                    label: label.into(),
                    state: "running".to_string(),
                    started_ms: now_ms(),
                    finished_ms: None,
                    error: None,
                },
                canceled: canceled.clone(),
            },
        );
        (id, canceled)
    }

    pub fn finish(&self, id: u64, result: Result<(), String>) {
        if let Some(record) = self.tasks.lock().get_mut(&id) {
            record.info.finished_ms = Some(now_ms());
            record.info.state = if record.canceled.load(Ordering::Relaxed) {
                "canceled"
            } else if result.is_ok() {
                "completed"
            } else {
                "failed"
            }
            .to_string();
            record.info.error = result.err();
        }
    }

    pub fn cancel(&self, id: u64) -> bool {
        let tasks = self.tasks.lock();
        let Some(record) = tasks.get(&id) else {
            return false;
        };
        record.canceled.store(true, Ordering::Relaxed);
        true
    }

    pub fn is_canceled(flag: &AtomicBool) -> bool {
        flag.load(Ordering::Relaxed)
    }

    pub fn snapshot(&self) -> Vec<TaskInfo> {
        let mut tasks: Vec<_> = self
            .tasks
            .lock()
            .values()
            .map(|record| record.info.clone())
            .collect();
        tasks.sort_by_key(|task| std::cmp::Reverse(task.id));
        tasks
    }
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or_default()
}
