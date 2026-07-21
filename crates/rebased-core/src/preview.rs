use std::path::{Path, PathBuf};

use base64::{engine::general_purpose::STANDARD, Engine as _};

use crate::{
    diff_commits, diff_staged, diff_working, DiffHunk, DiffLine, DiffLineKind, FileDiff,
    FilePreview, FilePreviewKind, GitCli, RebasedError, Result,
};

const MAX_TEXT_BYTES: u64 = 2 * 1024 * 1024;
const MAX_IMAGE_BYTES: u64 = 10 * 1024 * 1024;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PreviewMode {
    Working,
    Staged,
    Commit,
}

pub fn file_preview(
    repo: &Path,
    git: &GitCli,
    path: &str,
    mode: PreviewMode,
    commit_hash: Option<&str>,
) -> Result<FilePreview> {
    match mode {
        PreviewMode::Working => preview_working(repo, git, path),
        PreviewMode::Staged => preview_staged(repo, git, path),
        PreviewMode::Commit => {
            let hash = commit_hash.ok_or_else(|| RebasedError::other("commit hash required"))?;
            preview_commit(repo, git, path, hash)
        }
    }
}

fn preview_working(repo: &Path, git: &GitCli, path: &str) -> Result<FilePreview> {
    let diff = diff_working(repo, git, path)?;
    if diff.is_binary {
        return preview_binary_working(repo, path, Some(diff));
    }
    if !diff.hunks.is_empty() {
        return Ok(text_diff_preview(path, diff));
    }

    let full_path = resolve_working_path(repo, path)?;
    if full_path.exists() {
        return preview_from_disk(path, &full_path);
    }

    preview_deleted(repo, git, path, PreviewMode::Working)
}

fn preview_staged(repo: &Path, git: &GitCli, path: &str) -> Result<FilePreview> {
    let diff = diff_staged(repo, git, path)?;
    if diff.is_binary {
        return preview_binary_staged(repo, git, path, Some(diff));
    }
    if !diff.hunks.is_empty() {
        return Ok(text_diff_preview(path, diff));
    }

    match show_blob(repo, git, ":", path) {
        Ok(bytes) => preview_from_bytes(path, &bytes, None),
        Err(_) => preview_deleted(repo, git, path, PreviewMode::Staged),
    }
}

fn preview_commit(repo: &Path, git: &GitCli, path: &str, hash: &str) -> Result<FilePreview> {
    let parents = commit_parents(repo, git, hash)?;

    if parents.is_empty() {
        match show_blob(repo, git, hash, path) {
            Ok(bytes) => {
                let mut preview = preview_from_bytes(path, &bytes, None)?;
                if preview.kind == FilePreviewKind::TextContent {
                    preview.diff = Some(synthetic_add_diff(path, preview.content.as_deref()));
                    preview.kind = FilePreviewKind::TextDiff;
                }
                Ok(preview)
            }
            Err(_) => Ok(deleted_preview(path, None)),
        }
    } else {
        let diff = diff_commits(repo, git, &parents[0], hash, Some(path))?;
        if diff.is_binary {
            return preview_binary_commit(repo, git, hash, path, Some(diff));
        }
        if !diff.hunks.is_empty() {
            return Ok(text_diff_preview(path, diff));
        }
        match show_blob(repo, git, hash, path) {
            Ok(bytes) => preview_from_bytes(path, &bytes, None),
            Err(_) => Ok(deleted_preview(path, Some(diff))),
        }
    }
}

fn text_diff_preview(path: &str, diff: FileDiff) -> FilePreview {
    FilePreview {
        path: path.to_string(),
        kind: FilePreviewKind::TextDiff,
        mime: mime_from_path(path),
        language: language_from_path(path),
        diff: Some(diff),
        content: None,
        data_base64: None,
        size_bytes: 0,
        absolute_path: None,
    }
}

fn preview_from_disk(path: &str, full_path: &Path) -> Result<FilePreview> {
    let meta = std::fs::metadata(full_path)?;
    let size = meta.len();
    preview_from_bytes(path, &std::fs::read(full_path)?, Some(full_path)).map(|mut p| {
        p.size_bytes = size;
        p.absolute_path = Some(full_path.to_string_lossy().to_string());
        p
    })
}

fn preview_from_bytes(path: &str, bytes: &[u8], absolute: Option<&Path>) -> Result<FilePreview> {
    let size = bytes.len() as u64;
    let ext = extension(path);

    if let Some(ext) = ext {
        if is_image_ext(ext) {
            if size <= MAX_IMAGE_BYTES {
                return Ok(FilePreview {
                    path: path.to_string(),
                    kind: FilePreviewKind::Image,
                    mime: mime_from_ext(ext),
                    language: None,
                    diff: None,
                    content: None,
                    data_base64: Some(STANDARD.encode(bytes)),
                    size_bytes: size,
                    absolute_path: absolute.map(|p| p.to_string_lossy().to_string()),
                });
            }
            return Ok(binary_preview(path, &mime_from_ext(ext), size, absolute));
        }
    }

    if is_text_bytes(bytes) && size <= MAX_TEXT_BYTES {
        let content = String::from_utf8_lossy(bytes).into_owned();
        return Ok(FilePreview {
            path: path.to_string(),
            kind: FilePreviewKind::TextContent,
            mime: mime_from_path(path),
            language: language_from_path(path),
            diff: None,
            content: Some(content),
            data_base64: None,
            size_bytes: size,
            absolute_path: absolute.map(|p| p.to_string_lossy().to_string()),
        });
    }

    Ok(binary_preview(path, &mime_from_path(path), size, absolute))
}

fn preview_binary_working(repo: &Path, path: &str, diff: Option<FileDiff>) -> Result<FilePreview> {
    let full_path = resolve_working_path(repo, path)?;
    if full_path.exists() {
        let bytes = std::fs::read(&full_path)?;
        let mut preview = preview_from_bytes(path, &bytes, Some(&full_path))?;
        preview.diff = diff;
        if preview.kind == FilePreviewKind::Image {
            preview.kind = FilePreviewKind::Image;
        } else if preview.kind != FilePreviewKind::Image {
            preview.kind = FilePreviewKind::Binary;
        }
        return Ok(preview);
    }
    Ok(deleted_preview(path, diff))
}

fn preview_binary_staged(
    repo: &Path,
    git: &GitCli,
    path: &str,
    diff: Option<FileDiff>,
) -> Result<FilePreview> {
    match show_blob(repo, git, ":", path) {
        Ok(bytes) => {
            let mut preview = preview_from_bytes(path, &bytes, None)?;
            preview.diff = diff;
            Ok(preview)
        }
        Err(_) => Ok(deleted_preview(path, diff)),
    }
}

fn preview_binary_commit(
    repo: &Path,
    git: &GitCli,
    hash: &str,
    path: &str,
    diff: Option<FileDiff>,
) -> Result<FilePreview> {
    match show_blob(repo, git, hash, path) {
        Ok(bytes) => {
            let mut preview = preview_from_bytes(path, &bytes, None)?;
            preview.diff = diff;
            Ok(preview)
        }
        Err(_) => Ok(deleted_preview(path, diff)),
    }
}

fn preview_deleted(
    repo: &Path,
    git: &GitCli,
    path: &str,
    mode: PreviewMode,
) -> Result<FilePreview> {
    let diff = match mode {
        PreviewMode::Working => diff_working(repo, git, path).ok(),
        PreviewMode::Staged => diff_staged(repo, git, path).ok(),
        PreviewMode::Commit => None,
    };

    // The change may be a deletion in the index/HEAD while the file still
    // exists in the working tree (e.g. staged deletion but recreated on disk).
    // In that case show the actual file content instead of a misleading
    // "deleted / unavailable" message.
    if let Ok(full_path) = resolve_working_path(repo, path) {
        if full_path.exists() {
            if let Ok(mut preview) = preview_from_disk(path, &full_path) {
                preview.diff = diff;
                return Ok(preview);
            }
        }
    }

    Ok(deleted_preview(path, diff))
}

fn deleted_preview(path: &str, diff: Option<FileDiff>) -> FilePreview {
    FilePreview {
        path: path.to_string(),
        kind: FilePreviewKind::Deleted,
        mime: mime_from_path(path),
        language: language_from_path(path),
        diff,
        content: None,
        data_base64: None,
        size_bytes: 0,
        absolute_path: None,
    }
}

fn binary_preview(path: &str, mime: &str, size: u64, absolute: Option<&Path>) -> FilePreview {
    FilePreview {
        path: path.to_string(),
        kind: FilePreviewKind::Binary,
        mime: mime.to_string(),
        language: None,
        diff: None,
        content: None,
        data_base64: None,
        size_bytes: size,
        absolute_path: absolute.map(|p| p.to_string_lossy().to_string()),
    }
}

fn synthetic_add_diff(path: &str, content: Option<&str>) -> FileDiff {
    let text = content.unwrap_or("");
    let lines: Vec<DiffLine> = text
        .lines()
        .enumerate()
        .map(|(i, line)| DiffLine {
            kind: DiffLineKind::Add,
            content: line.to_string(),
            old_lineno: None,
            new_lineno: Some((i + 1) as u32),
        })
        .collect();
    let line_count = lines.len().max(1) as u32;
    FileDiff {
        path: path.to_string(),
        old_path: None,
        hunks: vec![DiffHunk {
            old_start: 0,
            old_lines: 0,
            new_start: 1,
            new_lines: line_count,
            lines,
        }],
        is_binary: false,
    }
}

fn show_blob(repo: &Path, git: &GitCli, rev: &str, path: &str) -> Result<Vec<u8>> {
    let spec = if rev == ":" {
        format!(":{path}")
    } else {
        format!("{rev}:{path}")
    };
    git.run_ok_bytes(repo, &["show", &spec])
}

fn commit_parents(repo: &Path, git: &GitCli, hash: &str) -> Result<Vec<String>> {
    let output = git.run_ok(repo, &["rev-list", "--parents", "-n", "1", hash])?;
    let parts: Vec<&str> = output.split_whitespace().collect();
    if parts.len() <= 1 {
        return Ok(Vec::new());
    }
    Ok(parts[1..].iter().map(|s| s.to_string()).collect())
}

fn resolve_working_path(repo: &Path, path: &str) -> Result<PathBuf> {
    let full = repo.join(path);
    let repo_canonical = repo.canonicalize().unwrap_or_else(|_| repo.to_path_buf());
    let resolved = full.canonicalize().unwrap_or(full);
    if !resolved.starts_with(&repo_canonical) {
        return Err(RebasedError::other("path outside repository"));
    }
    Ok(resolved)
}

fn extension(path: &str) -> Option<&str> {
    Path::new(path).extension()?.to_str()
}

fn is_image_ext(ext: &str) -> bool {
    matches!(
        ext.to_lowercase().as_str(),
        "png" | "jpg" | "jpeg" | "gif" | "webp" | "svg" | "ico" | "bmp"
    )
}

fn is_text_bytes(bytes: &[u8]) -> bool {
    let sample = &bytes[..bytes.len().min(8192)];
    if sample.contains(&0) {
        return false;
    }
    std::str::from_utf8(sample).is_ok()
}

fn mime_from_ext(ext: &str) -> String {
    match ext.to_lowercase().as_str() {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "svg" => "image/svg+xml",
        "ico" => "image/x-icon",
        "bmp" => "image/bmp",
        "json" => "application/json",
        "xml" => "application/xml",
        "html" | "htm" => "text/html",
        "css" => "text/css",
        "js" | "mjs" | "cjs" => "text/javascript",
        "md" => "text/markdown",
        "yaml" | "yml" => "text/yaml",
        _ => "text/plain",
    }
    .to_string()
}

fn mime_from_path(path: &str) -> String {
    extension(path)
        .map(mime_from_ext)
        .unwrap_or_else(|| "application/octet-stream".to_string())
}

fn language_from_path(path: &str) -> Option<String> {
    let ext = extension(path)?.to_lowercase();
    let lang = match ext.as_str() {
        "js" | "mjs" | "cjs" => "javascript",
        "ts" => "typescript",
        "tsx" | "jsx" => "tsx",
        "rs" => "rust",
        "py" => "python",
        "java" => "java",
        "kt" | "kts" => "kotlin",
        "xml" => "xml",
        "html" | "htm" => "html",
        "css" => "css",
        "md" => "markdown",
        "yaml" | "yml" => "yaml",
        "sh" | "bash" | "zsh" => "shell",
        "vue" => "vue",
        "json" => "json",
        "go" => "go",
        "c" | "h" => "c",
        "cpp" | "cc" | "cxx" | "hpp" => "cpp",
        "sql" => "sql",
        "toml" => "toml",
        "properties" => "properties",
        "txt" => "text",
        "gradle" => "groovy",
        "swift" => "swift",
        "rb" => "ruby",
        "php" => "php",
        "scala" => "scala",
        "dockerfile" => "dockerfile",
        _ if ext == "dockerfile" || path.to_lowercase().ends_with("dockerfile") => "dockerfile",
        _ => return None,
    };
    Some(lang.to_string())
}
