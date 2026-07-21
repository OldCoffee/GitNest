use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::OnceLock;

use tracing_appender::rolling::{RollingFileAppender, Rotation};
use tracing_subscriber::{fmt, layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

static LOG_DIR: OnceLock<PathBuf> = OnceLock::new();

pub fn log_dir() -> Option<&'static Path> {
    LOG_DIR.get().map(PathBuf::as_path)
}

/// Initialize stderr + rolling file logging and a panic hook.
pub fn init(app_log_dir: PathBuf) -> Result<(), String> {
    fs::create_dir_all(&app_log_dir).map_err(|e| e.to_string())?;
    let _ = LOG_DIR.set(app_log_dir.clone());

    let file_appender = RollingFileAppender::builder()
        .rotation(Rotation::DAILY)
        .filename_prefix("gitnest")
        .filename_suffix("log")
        .max_log_files(3)
        .build(&app_log_dir)
        .map_err(|e| e.to_string())?;
    let (non_blocking, guard) = tracing_appender::non_blocking(file_appender);
    // Keep the worker thread alive for the process lifetime.
    std::mem::forget(guard);

    let env_filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new("gitnest_app=info,rebased_core=info"));

    let _ = tracing_subscriber::registry()
        .with(env_filter)
        .with(fmt::layer().with_writer(std::io::stderr))
        .with(fmt::layer().with_ansi(false).with_writer(non_blocking))
        .try_init();

    install_panic_hook(app_log_dir.join("panic.log"));
    Ok(())
}

fn install_panic_hook(panic_path: PathBuf) {
    let default_hook = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |info| {
        let message = format!(
            "{}\nlocation: {}\n",
            info,
            info.location()
                .map(|l| l.to_string())
                .unwrap_or_else(|| "unknown".into())
        );
        if let Ok(mut file) = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&panic_path)
        {
            let _ = writeln!(file, "---- panic {} ----", unix_now());
            let _ = write!(file, "{message}");
        }
        default_hook(info);
    }));
}

fn unix_now() -> u64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

/// Tail of the newest `gitnest*.log` under the log dir (best-effort).
pub fn recent_log_tail(max_bytes: usize) -> Option<(PathBuf, String)> {
    let dir = LOG_DIR.get()?;
    let mut logs: Vec<_> = fs::read_dir(dir)
        .ok()?
        .filter_map(|e| e.ok())
        .map(|e| e.path())
        .filter(|p| {
            p.file_name()
                .and_then(|n| n.to_str())
                .is_some_and(|n| n.starts_with("gitnest") && n.ends_with(".log"))
        })
        .collect();
    logs.sort();
    let path = logs.pop()?;
    let bytes = fs::read(&path).ok()?;
    let start = bytes.len().saturating_sub(max_bytes);
    let text = String::from_utf8_lossy(&bytes[start..]).into_owned();
    Some((path, text))
}

pub fn panic_log_path() -> Option<PathBuf> {
    LOG_DIR.get().map(|d| d.join("panic.log"))
}
