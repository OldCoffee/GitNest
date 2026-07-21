use std::path::PathBuf;
use std::process::Command;

use rebased_core::AppSettings;
use serde::Serialize;
use tauri::State;

use crate::state::SharedState;

#[derive(Debug, Clone, Serialize)]
pub struct DiagnosticsReport {
    pub generated_at: String,
    pub app: DiagnosticsApp,
    pub runtime: DiagnosticsRuntime,
    pub git: DiagnosticsGit,
    pub repository: Option<DiagnosticsRepo>,
    pub settings: DiagnosticsSettingsSummary,
    pub logs: DiagnosticsLogs,
}

#[derive(Debug, Clone, Serialize)]
pub struct DiagnosticsLogs {
    pub log_dir: Option<String>,
    pub latest_log_path: Option<String>,
    pub panic_log_path: Option<String>,
    pub log_tail: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct DiagnosticsApp {
    pub name: String,
    pub version: String,
    pub identifier: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct DiagnosticsRuntime {
    pub os: String,
    pub arch: String,
    pub family: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct DiagnosticsGit {
    pub configured_path: String,
    pub version: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct DiagnosticsRepo {
    pub path: String,
    pub branch: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct DiagnosticsSettingsSummary {
    pub schema_version: u32,
    pub ui_theme: String,
    pub ui_language: String,
    pub default_remote: String,
    pub diff_mode: String,
    pub confirm_discard: bool,
    pub git_path: String,
    pub shell_path_set: bool,
    pub java_home_set: bool,
    pub jdt_ls_path_set: bool,
    pub maven_home_set: bool,
    pub recent_repos_count: usize,
    pub recent_repos_tail: Vec<String>,
}

fn git_version(git_path: &str) -> Option<String> {
    let output = Command::new(git_path).arg("--version").output().ok()?;
    if !output.status.success() {
        return None;
    }
    String::from_utf8(output.stdout)
        .ok()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
}

pub fn settings_summary(settings: &AppSettings) -> DiagnosticsSettingsSummary {
    let mut recent = settings.recent_repos.clone();
    if recent.len() > 5 {
        recent = recent.split_off(recent.len().saturating_sub(5));
    }
    DiagnosticsSettingsSummary {
        schema_version: settings.schema_version,
        ui_theme: settings.ui_theme.clone(),
        ui_language: settings.ui_language.clone(),
        default_remote: settings.default_remote.clone(),
        diff_mode: settings.diff_mode.clone(),
        confirm_discard: settings.confirm_discard,
        git_path: settings.git_path.clone(),
        shell_path_set: !settings.shell_path.trim().is_empty(),
        java_home_set: !settings.java_home.trim().is_empty(),
        jdt_ls_path_set: !settings.jdt_ls_path.trim().is_empty(),
        maven_home_set: !settings.maven_home.trim().is_empty(),
        recent_repos_count: settings.recent_repos.len(),
        recent_repos_tail: recent,
    }
}

fn build_report(state: &SharedState) -> DiagnosticsReport {
    let settings = state.settings_snapshot();
    let repo = state.repo.lock();
    let repository = repo.as_ref().map(|r| DiagnosticsRepo {
        path: r.path().display().to_string(),
        branch: None,
    });
    drop(repo);

    let (latest_log_path, log_tail) = crate::logging::recent_log_tail(8_192)
        .map(|(p, t)| (Some(p.to_string_lossy().into_owned()), Some(t)))
        .unwrap_or((None, None));

    DiagnosticsReport {
        generated_at: chrono_like_now(),
        app: DiagnosticsApp {
            name: "GitNest".into(),
            version: env!("CARGO_PKG_VERSION").into(),
            identifier: "io.github.oldcoffee.gitnest".into(),
        },
        runtime: DiagnosticsRuntime {
            os: std::env::consts::OS.into(),
            arch: std::env::consts::ARCH.into(),
            family: std::env::consts::FAMILY.into(),
        },
        git: DiagnosticsGit {
            configured_path: settings.git_path.clone(),
            version: git_version(&settings.git_path),
        },
        repository,
        settings: settings_summary(&settings),
        logs: DiagnosticsLogs {
            log_dir: crate::logging::log_dir().map(|p| p.to_string_lossy().into_owned()),
            latest_log_path,
            panic_log_path: crate::logging::panic_log_path()
                .map(|p| p.to_string_lossy().into_owned()),
            log_tail,
        },
    }
}

fn chrono_like_now() -> String {
    // Avoid adding a chrono dependency; RFC3339-ish UTC from system time.
    use std::time::{SystemTime, UNIX_EPOCH};
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    format!("unix:{secs}")
}

/// Write a redacted diagnostics JSON report to `path`. Returns the absolute path written.
#[tauri::command]
pub fn export_diagnostics(path: String, state: State<'_, SharedState>) -> Result<String, String> {
    let report = build_report(&state);
    let json = serde_json::to_string_pretty(&report).map_err(|e| e.to_string())?;
    let target = PathBuf::from(&path);
    if let Some(parent) = target.parent() {
        if !parent.as_os_str().is_empty() {
            std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
    }
    std::fs::write(&target, json).map_err(|e| e.to_string())?;
    Ok(target.to_string_lossy().into_owned())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn settings_summary_redacts_long_recent_list() {
        let settings = AppSettings {
            recent_repos: (0..8).map(|i| format!("/tmp/repo-{i}")).collect(),
            shell_path: "/bin/zsh".into(),
            java_home: "/opt/jdk".into(),
            ..Default::default()
        };
        let summary = settings_summary(&settings);
        assert_eq!(summary.recent_repos_count, 8);
        assert_eq!(summary.recent_repos_tail.len(), 5);
        assert!(summary.shell_path_set);
        assert!(summary.java_home_set);
        assert!(!summary.maven_home_set);
    }
}
