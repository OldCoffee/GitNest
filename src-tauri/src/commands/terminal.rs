use std::process::{Command, Stdio};

use tauri::State;

use crate::state::SharedState;

fn default_shell() -> String {
    if cfg!(windows) {
        std::env::var("COMSPEC").unwrap_or_else(|_| "powershell.exe".to_string())
    } else {
        std::env::var("SHELL").unwrap_or_else(|_| "/bin/sh".to_string())
    }
}

#[tauri::command]
pub fn terminal_run(command: String, state: State<'_, SharedState>) -> Result<String, String> {
    let settings = state.settings_snapshot();
    let repo_path = state.repo_path().ok();
    let shell = if settings.shell_path.is_empty() {
        default_shell()
    } else {
        settings.shell_path
    };
    let mut cmd = if cfg!(windows) {
        let mut c = Command::new(&shell);
        c.args(["-NoProfile", "-Command", &command]);
        c
    } else {
        let mut c = Command::new(&shell);
        c.args(["-lc", &command]);
        c
    };
    if let Some(path) = repo_path {
        cmd.current_dir(path);
    }
    let output = cmd
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .map_err(|e| e.to_string())?;
    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    Ok(format!("{stdout}{stderr}"))
}
