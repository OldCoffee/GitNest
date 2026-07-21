use std::collections::HashSet;
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::time::UNIX_EPOCH;

use rebased_core::{ProjectEntry, ProjectTreeRow};
use serde::Serialize;
use tauri::State;

use crate::state::SharedState;

const MAX_EDIT_BYTES: u64 = 4 * 1024 * 1024;

#[derive(Serialize)]
pub struct ProjectFileText {
    pub content: String,
    pub is_binary: bool,
    pub too_large: bool,
    pub size_bytes: u64,
    pub modified_ms: u64,
}

fn modified_ms(meta: &fs::Metadata) -> u64 {
    meta.modified()
        .ok()
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or_default()
}

fn looks_binary(bytes: &[u8]) -> bool {
    let sample = &bytes[..bytes.len().min(8192)];
    if sample.contains(&0) {
        return true;
    }
    std::str::from_utf8(sample).is_err()
}

fn is_image_path(path: &Path) -> bool {
    path.extension()
        .and_then(|ext| ext.to_str())
        .is_some_and(|ext| {
            matches!(
                ext.to_ascii_lowercase().as_str(),
                "png" | "jpg" | "jpeg" | "gif" | "webp" | "svg" | "ico" | "bmp"
            )
        })
}

fn should_hide(name: &str) -> bool {
    name == ".git"
}

fn is_heavy_dir_name(name: &str) -> bool {
    matches!(
        name,
        "node_modules" | "target" | "dist" | "build" | "vendor" | ".yarn" | "coverage"
    )
}

fn should_skip_traversal(name: &str) -> bool {
    is_heavy_dir_name(name)
}

fn batch_git_ignored(state: &SharedState, paths: &[String]) -> HashSet<String> {
    if paths.is_empty() {
        return HashSet::new();
    }
    state
        .git_service
        .handle()
        .and_then(|(repo_path, git)| {
            let mut child = std::process::Command::new(&git.git_path)
                .current_dir(repo_path)
                .args(["check-ignore", "--stdin"])
                .stdin(Stdio::piped())
                .stdout(Stdio::piped())
                .stderr(Stdio::null())
                .spawn()
                .map_err(|error| error.to_string())?;
            if let Some(mut stdin) = child.stdin.take() {
                for path in paths {
                    writeln!(stdin, "{path}").map_err(|error| error.to_string())?;
                }
            }
            let output = child
                .wait_with_output()
                .map_err(|error| error.to_string())?;
            Ok(output
                .stdout
                .split(|b| *b == b'\n')
                .filter_map(|line| {
                    let text = std::str::from_utf8(line).ok()?.trim();
                    if text.is_empty() {
                        None
                    } else {
                        Some(text.to_string())
                    }
                })
                .collect())
        })
        .unwrap_or_default()
}

fn sort_entries(entries: &mut [ProjectEntry]) {
    entries.sort_by(|a, b| match (a.is_dir, b.is_dir) {
        (true, false) => std::cmp::Ordering::Less,
        (false, true) => std::cmp::Ordering::Greater,
        _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
    });
}

fn collect_tree_rows(
    dir: &Path,
    parent_rel: Option<&str>,
    depth: u32,
    rows: &mut Vec<ProjectTreeRow>,
    paths_for_ignore: &mut Vec<String>,
) -> Result<(), String> {
    let mut entries: Vec<ProjectEntry> = fs::read_dir(dir)
        .map_err(|e| e.to_string())?
        .filter_map(|entry| {
            let entry = entry.ok()?;
            let name = entry.file_name().to_string_lossy().into_owned();
            if should_hide(&name) {
                return None;
            }
            let meta = entry.metadata().ok()?;
            let is_dir = meta.is_dir();
            let path = match parent_rel {
                None => name.clone(),
                Some(parent) => format!("{parent}/{name}"),
            };
            Some(ProjectEntry {
                name,
                path: path.clone(),
                is_dir,
                git_ignored: false,
            })
        })
        .collect();
    sort_entries(&mut entries);

    for entry in entries {
        paths_for_ignore.push(entry.path.clone());
        rows.push(ProjectTreeRow {
            name: entry.name.clone(),
            path: entry.path.clone(),
            is_dir: entry.is_dir,
            git_ignored: false,
            depth,
        });
        if entry.is_dir && !should_skip_traversal(&entry.name) {
            let child_dir = dir.join(&entry.name);
            collect_tree_rows(
                &child_dir,
                Some(entry.path.as_str()),
                depth + 1,
                rows,
                paths_for_ignore,
            )?;
        }
    }
    Ok(())
}

fn repo_root(state: &SharedState) -> Result<PathBuf, String> {
    state.repo_path()
}

fn resolve_existing(state: &SharedState, relative: &str) -> Result<PathBuf, String> {
    let repo_path = repo_root(state)?;
    let joined = repo_path.join(relative);
    if !joined.exists() {
        return Err("invalid path: No such file or directory (os error 2)".into());
    }
    let repo_canonical = repo_path
        .canonicalize()
        .unwrap_or_else(|_| repo_path.clone());
    let canonical = joined.canonicalize().unwrap_or_else(|_| joined.clone());
    if canonical.starts_with(&repo_canonical) {
        return Ok(canonical);
    }
    // Unicode normalization can make canonicalize paths diverge on macOS (CJK).
    let joined_s = joined.to_string_lossy().replace('\\', "/");
    let repo_s = repo_path.to_string_lossy().replace('\\', "/");
    let repo_prefix = repo_s.trim_end_matches('/');
    if joined_s == repo_prefix || joined_s.starts_with(&format!("{repo_prefix}/")) {
        return Ok(joined);
    }
    Err("path outside repository".into())
}

fn resolve_parent(state: &SharedState, parent_relative: Option<String>) -> Result<PathBuf, String> {
    let repo_path = repo_root(state)?;
    let parent_ref = parent_relative.filter(|p| !p.is_empty());
    let joined = match parent_ref.as_deref() {
        None => repo_path.clone(),
        Some(rel) => repo_path.join(rel),
    };
    let canonical = joined
        .canonicalize()
        .map_err(|e| format!("invalid parent path: {e}"))?;
    let repo_canonical = repo_path
        .canonicalize()
        .map_err(|e| format!("repo path error: {e}"))?;
    if !canonical.starts_with(&repo_canonical) {
        return Err("path outside repository".into());
    }
    if !canonical.is_dir() {
        return Err("parent is not a directory".into());
    }
    Ok(canonical)
}

fn relative_from_repo(repo_path: &Path, absolute: &Path) -> Result<String, String> {
    absolute
        .strip_prefix(repo_path)
        .map(|p| p.to_string_lossy().replace('\\', "/"))
        .map_err(|_| "path outside repository".into())
}

fn validate_name(name: &str) -> Result<(), String> {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return Err("name is empty".into());
    }
    if trimmed.contains('/') || trimmed.contains('\\') {
        return Err("name must not contain path separators".into());
    }
    if trimmed == "." || trimmed == ".." {
        return Err("invalid name".into());
    }
    Ok(())
}

fn unique_dest_in_dir(dest_dir: &Path, file_name: &std::ffi::OsStr) -> Result<PathBuf, String> {
    let mut target = dest_dir.join(file_name);
    if !target.exists() {
        return Ok(target);
    }
    let stem = file_name.to_string_lossy();
    let mut index = 1;
    loop {
        let candidate = dest_dir.join(format!("{stem} copy{index}"));
        if !candidate.exists() {
            target = candidate;
            break;
        }
        index += 1;
        if index > 999 {
            return Err("too many copies".into());
        }
    }
    Ok(target)
}

fn gitignore_pattern(relative_path: &str, is_dir: bool) -> String {
    if is_dir && !relative_path.ends_with('/') {
        format!("{relative_path}/")
    } else {
        relative_path.to_string()
    }
}

#[cfg(target_os = "macos")]
fn read_clipboard_file_paths() -> Result<Vec<String>, String> {
    use std::process::Command;
    let script = r#"try
    set paths to {}
    set fileList to the clipboard as «class furl»
    if class of fileList is list then
        repeat with f in fileList
            set end of paths to POSIX path of f
        end repeat
    else
        set paths to {POSIX path of fileList}
    end if
    set oldDelims to AppleScript's text item delimiters
    set AppleScript's text item delimiters to linefeed
    set outText to paths as string
    set AppleScript's text item delimiters to oldDelims
    return outText
on error
    return ""
end try"#;
    let output = Command::new("osascript")
        .arg("-e")
        .arg(script)
        .output()
        .map_err(|e| e.to_string())?;
    let text = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if text.is_empty() {
        return Ok(vec![]);
    }
    Ok(text
        .lines()
        .map(str::trim)
        .filter(|l| !l.is_empty())
        .map(str::to_string)
        .collect())
}

#[cfg(target_os = "windows")]
fn read_clipboard_file_paths() -> Result<Vec<String>, String> {
    use std::process::Command;
    let script = r#"Add-Type -AssemblyName System.Windows.Forms
$files = [System.Windows.Forms.Clipboard]::GetFileDropList()
if ($files -and $files.Count -gt 0) { $files -join [Environment]::NewLine }"#;
    let output = Command::new("powershell")
        .args(["-NoProfile", "-NonInteractive", "-Command", script])
        .output()
        .map_err(|e| e.to_string())?;
    let text = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if text.is_empty() {
        return Ok(vec![]);
    }
    Ok(text
        .lines()
        .map(str::trim)
        .filter(|l| !l.is_empty())
        .map(str::to_string)
        .collect())
}

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
fn read_clipboard_file_paths() -> Result<Vec<String>, String> {
    Ok(vec![])
}

fn copy_dir_recursive(src: &Path, dest: &Path) -> Result<(), String> {
    fs::create_dir_all(dest).map_err(|e| e.to_string())?;
    for entry in fs::read_dir(src).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let file_name = entry.file_name();
        let from = entry.path();
        let to = dest.join(&file_name);
        if from.is_dir() {
            copy_dir_recursive(&from, &to)?;
        } else {
            fs::copy(&from, &to).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn list_project_entries(
    relative_path: Option<String>,
    state: State<'_, SharedState>,
) -> Result<Vec<ProjectEntry>, String> {
    let state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || list_project_entries_inner(relative_path, &state))
        .await
        .map_err(|e| e.to_string())?
}

fn list_project_entries_inner(
    relative_path: Option<String>,
    state: &SharedState,
) -> Result<Vec<ProjectEntry>, String> {
    let parent_path = relative_path.filter(|p| !p.is_empty());
    let parent_ref = parent_path.as_deref();
    let target = resolve_parent(state, parent_path.clone())?;

    let mut entries: Vec<ProjectEntry> = fs::read_dir(&target)
        .map_err(|e| e.to_string())?
        .filter_map(|entry| {
            let entry = entry.ok()?;
            let name = entry.file_name().to_string_lossy().into_owned();
            if should_hide(&name) {
                return None;
            }
            let meta = entry.metadata().ok()?;
            let is_dir = meta.is_dir();
            let path = match parent_ref {
                None => name.clone(),
                Some(parent) => format!("{parent}/{name}"),
            };
            Some(ProjectEntry {
                name,
                path,
                is_dir,
                git_ignored: false,
            })
        })
        .collect();

    let paths: Vec<_> = entries.iter().map(|entry| entry.path.clone()).collect();
    let ignored = batch_git_ignored(state, &paths);
    for entry in &mut entries {
        entry.git_ignored = ignored.contains(&entry.path);
    }
    sort_entries(&mut entries);

    Ok(entries)
}

#[tauri::command]
pub async fn list_project_tree(
    state: State<'_, SharedState>,
) -> Result<Vec<ProjectTreeRow>, String> {
    let state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || list_project_tree_inner(&state))
        .await
        .map_err(|e| e.to_string())?
}

fn list_project_tree_inner(state: &SharedState) -> Result<Vec<ProjectTreeRow>, String> {
    let repo_path = repo_root(state)?;
    let mut rows = Vec::new();
    let mut paths_for_ignore = Vec::new();
    collect_tree_rows(&repo_path, None, 0, &mut rows, &mut paths_for_ignore)?;
    let ignored = batch_git_ignored(state, &paths_for_ignore);
    for row in &mut rows {
        row.git_ignored = ignored.contains(&row.path);
    }
    Ok(rows)
}

#[tauri::command]
pub fn create_project_file(
    parent_path: Option<String>,
    name: String,
    state: State<'_, SharedState>,
) -> Result<String, String> {
    validate_name(&name)?;
    let parent = resolve_parent(&state, parent_path)?;
    let repo_path = repo_root(&state)?;
    let target = parent.join(name.trim());
    if target.exists() {
        return Err("path already exists".into());
    }
    fs::File::create(&target).map_err(|e| e.to_string())?;
    relative_from_repo(&repo_path, &target)
}

#[tauri::command]
pub fn create_project_directory(
    parent_path: Option<String>,
    name: String,
    state: State<'_, SharedState>,
) -> Result<String, String> {
    validate_name(&name)?;
    let parent = resolve_parent(&state, parent_path)?;
    let repo_path = repo_root(&state)?;
    let target = parent.join(name.trim());
    if target.exists() {
        return Err("path already exists".into());
    }
    fs::create_dir_all(&target).map_err(|e| e.to_string())?;
    relative_from_repo(&repo_path, &target)
}

#[tauri::command]
pub fn rename_project_entry(
    path: String,
    new_name: String,
    state: State<'_, SharedState>,
) -> Result<String, String> {
    validate_name(&new_name)?;
    let repo_path = repo_root(&state)?;
    let source = resolve_existing(&state, &path)?;
    let parent = source.parent().ok_or_else(|| "invalid path".to_string())?;
    let target = parent.join(new_name.trim());
    if target.exists() {
        return Err("path already exists".into());
    }
    fs::rename(&source, &target).map_err(|e| e.to_string())?;
    relative_from_repo(&repo_path, &target)
}

#[tauri::command]
pub fn move_project_entry(
    source_path: String,
    dest_dir_path: Option<String>,
    state: State<'_, SharedState>,
) -> Result<String, String> {
    let repo_path = repo_root(&state)?;
    let source = resolve_existing(&state, &source_path)?;
    let dest_dir = resolve_parent(&state, dest_dir_path)?;
    let file_name = source
        .file_name()
        .ok_or_else(|| "invalid source".to_string())?;
    let target = dest_dir.join(file_name);
    if target.exists() {
        return Err("destination already exists".into());
    }
    if source.starts_with(&target) {
        return Err("cannot move into itself".into());
    }
    fs::rename(&source, &target).map_err(|e| e.to_string())?;
    relative_from_repo(&repo_path, &target)
}

#[tauri::command]
pub fn copy_project_entry(
    source_path: String,
    dest_dir_path: Option<String>,
    state: State<'_, SharedState>,
) -> Result<String, String> {
    let repo_path = repo_root(&state)?;
    let source = resolve_existing(&state, &source_path)?;
    let dest_dir = resolve_parent(&state, dest_dir_path)?;
    let file_name = source
        .file_name()
        .ok_or_else(|| "invalid source".to_string())?;
    let target = unique_dest_in_dir(&dest_dir, file_name)?;
    if source.is_dir() {
        copy_dir_recursive(&source, &target)?;
    } else {
        fs::copy(&source, &target).map_err(|e| e.to_string())?;
    }
    relative_from_repo(&repo_path, &target)
}

#[tauri::command]
pub fn delete_project_entry(path: String, state: State<'_, SharedState>) -> Result<(), String> {
    let target = resolve_existing(&state, &path)?;
    if target.is_dir() {
        fs::remove_dir_all(&target).map_err(|e| e.to_string())
    } else {
        fs::remove_file(&target).map_err(|e| e.to_string())
    }
}

fn read_file_text(abs: &Path) -> Result<ProjectFileText, String> {
    if !abs.is_file() {
        return Err("path is not a file".into());
    }
    let meta = fs::metadata(abs).map_err(|e| e.to_string())?;
    let size = meta.len();
    let modified = modified_ms(&meta);
    // Images are opened via asset protocol in the editor — skip loading bytes as text.
    if is_image_path(abs) {
        return Ok(ProjectFileText {
            content: String::new(),
            is_binary: true,
            too_large: false,
            size_bytes: size,
            modified_ms: modified,
        });
    }
    if size > MAX_EDIT_BYTES {
        return Ok(ProjectFileText {
            content: String::new(),
            is_binary: false,
            too_large: true,
            size_bytes: size,
            modified_ms: modified,
        });
    }
    let bytes = fs::read(abs).map_err(|e| e.to_string())?;
    if looks_binary(&bytes) {
        return Ok(ProjectFileText {
            content: String::new(),
            is_binary: true,
            too_large: false,
            size_bytes: size,
            modified_ms: modified,
        });
    }
    Ok(ProjectFileText {
        content: String::from_utf8_lossy(&bytes).into_owned(),
        is_binary: false,
        too_large: false,
        size_bytes: size,
        modified_ms: modified,
    })
}

#[tauri::command]
pub fn read_text_file(
    path: String,
    state: State<'_, SharedState>,
) -> Result<ProjectFileText, String> {
    let abs = resolve_existing(&state, &path)?;
    read_file_text(&abs)
}

/// Read an absolute filesystem path for LSP navigation outside the repository.
#[tauri::command]
pub fn read_absolute_text_file(path: String) -> Result<ProjectFileText, String> {
    let candidate = PathBuf::from(&path);
    let abs = if candidate.exists() {
        candidate.canonicalize().unwrap_or(candidate)
    } else {
        candidate
            .canonicalize()
            .map_err(|e| format!("invalid path: {e}"))?
    };
    read_file_text(&abs)
}

#[tauri::command]
pub fn write_text_file(
    path: String,
    content: String,
    expected_modified_ms: Option<u64>,
    force: Option<bool>,
    state: State<'_, SharedState>,
) -> Result<u64, String> {
    let abs = resolve_existing(&state, &path)?;
    if !abs.is_file() {
        return Err("path is not a file".into());
    }
    let current = fs::metadata(&abs).map_err(|e| e.to_string())?;
    let current_modified = modified_ms(&current);
    if !force.unwrap_or(false)
        && expected_modified_ms.is_some()
        && expected_modified_ms != Some(current_modified)
    {
        return Err("FILE_MODIFIED: file changed on disk".into());
    }
    fs::write(&abs, content.as_bytes()).map_err(|e| e.to_string())?;
    let saved = fs::metadata(&abs).map_err(|e| e.to_string())?;
    Ok(modified_ms(&saved))
}

#[tauri::command]
pub fn get_project_absolute_path(
    path: String,
    state: State<'_, SharedState>,
) -> Result<String, String> {
    let repo_path = repo_root(&state)?;
    if path.is_empty() {
        return Ok(repo_path.to_string_lossy().into_owned());
    }
    let absolute = resolve_existing(&state, &path)?;
    Ok(absolute.to_string_lossy().into_owned())
}

#[tauri::command]
pub fn add_to_gitignore(path: String, state: State<'_, SharedState>) -> Result<(), String> {
    let repo_path = repo_root(&state)?;
    let entry = resolve_existing(&state, &path)?;
    let relative = relative_from_repo(&repo_path, &entry)?;
    if relative == ".gitignore" {
        return Err("cannot add .gitignore to itself".into());
    }
    let pattern = gitignore_pattern(&relative, entry.is_dir());
    let gitignore_path = repo_path.join(".gitignore");
    let existing = if gitignore_path.exists() {
        fs::read_to_string(&gitignore_path).map_err(|e| e.to_string())?
    } else {
        String::new()
    };
    let already_present = existing.lines().any(|line| {
        let trimmed = line.trim();
        trimmed == pattern || trimmed == relative
    });
    if already_present {
        return Ok(());
    }
    let mut new_content = existing;
    if !new_content.is_empty() && !new_content.ends_with('\n') {
        new_content.push('\n');
    }
    new_content.push_str(&pattern);
    new_content.push('\n');
    fs::write(&gitignore_path, new_content).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn import_external_entries(
    external_paths: Vec<String>,
    dest_dir_path: Option<String>,
    state: State<'_, SharedState>,
) -> Result<Vec<String>, String> {
    if external_paths.is_empty() {
        return Ok(vec![]);
    }
    let repo_path = repo_root(&state)?;
    let repo_canonical = repo_path
        .canonicalize()
        .map_err(|e| format!("repo path error: {e}"))?;
    let dest_dir = resolve_parent(&state, dest_dir_path)?;
    let mut imported = Vec::new();
    for external in external_paths {
        let source = PathBuf::from(&external);
        let source = source
            .canonicalize()
            .map_err(|e| format!("invalid path {external}: {e}"))?;
        if source.starts_with(&repo_canonical) {
            continue;
        }
        let file_name = source
            .file_name()
            .ok_or_else(|| format!("invalid source: {external}"))?;
        let target = unique_dest_in_dir(&dest_dir, file_name)?;
        if source.is_dir() {
            copy_dir_recursive(&source, &target)?;
        } else {
            fs::copy(&source, &target).map_err(|e| e.to_string())?;
        }
        imported.push(relative_from_repo(&repo_path, &target)?);
    }
    Ok(imported)
}

#[tauri::command]
pub fn get_clipboard_file_paths() -> Result<Vec<String>, String> {
    read_clipboard_file_paths()
}
