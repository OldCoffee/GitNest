use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct PerfProbeConfig {
    pub repo_path: String,
    pub file_path: Option<String>,
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

/// Write a UI performance JSON report to the system temp directory.
/// Returns the absolute path written.
#[tauri::command]
pub fn write_perf_report(json: String) -> Result<String, String> {
    let path = std::env::temp_dir().join("gitnest-ui-perf.json");
    std::fs::write(&path, json).map_err(|error| error.to_string())?;
    Ok(path.to_string_lossy().into_owned())
}
