use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct PerfProbeConfig {
    pub repo_path: String,
    pub file_path: Option<String>,
    pub version: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct DesktopSmokeConfig {
    pub repo_path: String,
    pub version: String,
}

/// Read one-shot UI perf probe config from process env (set by scripts/ui-perf.sh).
#[tauri::command]
pub fn get_perf_probe_config() -> Option<PerfProbeConfig> {
    let repo_path = std::env::var("GITNEST_PERF_PROBE").ok()?;
    if repo_path.trim().is_empty() {
        return None;
    }
    let file_path = std::env::var("GITNEST_PERF_FILE")
        .ok()
        .filter(|s| !s.trim().is_empty());
    let version = std::env::var("GITNEST_PERF_VERSION")
        .unwrap_or_else(|_| env!("CARGO_PKG_VERSION").to_string());
    Some(PerfProbeConfig {
        repo_path,
        file_path,
        version,
    })
}

/// Read one-shot desktop smoke config (set by scripts/desktop-smoke.sh).
#[tauri::command]
pub fn get_desktop_smoke_config() -> Option<DesktopSmokeConfig> {
    let repo_path = std::env::var("GITNEST_DESKTOP_SMOKE").ok()?;
    if repo_path.trim().is_empty() {
        return None;
    }
    let version = std::env::var("GITNEST_SMOKE_VERSION")
        .unwrap_or_else(|_| env!("CARGO_PKG_VERSION").to_string());
    Some(DesktopSmokeConfig { repo_path, version })
}

/// Write a UI performance JSON report to the system temp directory.
/// Returns the absolute path written.
#[tauri::command]
pub fn write_perf_report(json: String) -> Result<String, String> {
    let path = std::env::temp_dir().join("gitnest-ui-perf.json");
    std::fs::write(&path, json).map_err(|error| error.to_string())?;
    Ok(path.to_string_lossy().into_owned())
}

/// Write a desktop smoke JSON report to the system temp directory.
#[tauri::command]
pub fn write_smoke_report(json: String) -> Result<String, String> {
    let path = std::env::temp_dir().join("gitnest-desktop-smoke.json");
    std::fs::write(&path, json).map_err(|error| error.to_string())?;
    Ok(path.to_string_lossy().into_owned())
}
