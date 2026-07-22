use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::process::Command;

use serde::Serialize;
use serde_json::Value;
use tauri::{AppHandle, State};

use crate::state::SharedState;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct JavaLspStatus {
    available: bool,
    java_executable: String,
    java_home: String,
    java_version: Option<String>,
    java_source: String,
    maven_home: String,
    maven_executable: String,
    maven_version: Option<String>,
    maven_source: String,
    maven_global_settings: Option<String>,
    maven_user_settings: Option<String>,
    jdt_ls_path: String,
    needs_install: bool,
    /// True when `<repo>/.git/gitnest/jdtls-workspace` already has Eclipse metadata.
    has_workspace_cache: bool,
    error: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DetectedJavaRuntime {
    home: String,
    executable: String,
    version: Option<String>,
    /// `manual` | `java_home` | `macos` | `path` | `none`
    source: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DetectedMavenRuntime {
    pub home: String,
    pub executable: String,
    pub version: Option<String>,
    /// `manual` | `m2_home` | `maven_home` | `path` | `none`
    pub source: String,
    pub global_settings: Option<String>,
    pub user_settings: Option<String>,
}

fn java_bin_name() -> &'static str {
    if cfg!(windows) {
        "java.exe"
    } else {
        "java"
    }
}

fn normalize_java_home(path: &Path) -> PathBuf {
    // Some installs report .../jre as java.home; prefer parent JDK if present.
    if path
        .file_name()
        .and_then(|name| name.to_str())
        .is_some_and(|name| name.eq_ignore_ascii_case("jre"))
    {
        if let Some(parent) = path.parent() {
            if parent.join("bin").join(java_bin_name()).is_file() {
                return parent.to_path_buf();
            }
        }
    }
    path.to_path_buf()
}

fn java_home_looks_valid(home: &Path) -> bool {
    home.join("bin").join(java_bin_name()).is_file()
}

fn read_java_version(java_exec: &Path) -> Option<String> {
    let output = Command::new(java_exec).arg("-version").output().ok()?;
    let text = if output.stderr.is_empty() {
        String::from_utf8_lossy(&output.stdout).into_owned()
    } else {
        String::from_utf8_lossy(&output.stderr).into_owned()
    };
    text.lines()
        .next()
        .map(|line| line.trim().to_string())
        .filter(|line| !line.is_empty())
}

fn parse_java_major(version_line: &str) -> Option<u32> {
    // Examples: openjdk version "21.0.6"  | java version "17.0.10" | java version "1.8.0_202"
    let quoted = version_line.find('"').and_then(|start| {
        let rest = &version_line[start + 1..];
        rest.find('"').map(|end| &rest[..end])
    })?;
    if let Some(rest) = quoted.strip_prefix("1.") {
        // 1.8 → 8
        return rest.split(['.', '_', '-']).next()?.parse::<u32>().ok();
    }
    quoted.split(['.', '_', '-']).next()?.parse::<u32>().ok()
}

fn runtime_from_home(home: PathBuf, source: &str) -> Option<DetectedJavaRuntime> {
    let home = normalize_java_home(&home);
    if !java_home_looks_valid(&home) {
        return None;
    }
    let executable = home.join("bin").join(java_bin_name());
    Some(DetectedJavaRuntime {
        home: home.to_string_lossy().into_owned(),
        executable: executable.to_string_lossy().into_owned(),
        version: read_java_version(&executable),
        source: source.into(),
    })
}

/// Latest JDT LS requires Java 21+ to launch. Project JDK may still be 17.
fn resolve_jdt_ls_runtime(project: &DetectedJavaRuntime) -> Result<DetectedJavaRuntime, String> {
    const MIN_MAJOR: u32 = 21;
    if let Some(major) = project.version.as_deref().and_then(parse_java_major) {
        if major >= MIN_MAJOR {
            return Ok(DetectedJavaRuntime {
                home: project.home.clone(),
                executable: project.executable.clone(),
                version: project.version.clone(),
                source: project.source.clone(),
            });
        }
    }

    if let Some(runtime) = find_java_runtime_at_least(MIN_MAJOR) {
        return Ok(runtime);
    }

    let found = project.version.clone().unwrap_or_else(|| "unknown".into());
    Err(format!(
        "JDT Language Server requires JDK {MIN_MAJOR}+ to run (current project JDK is {found}). Install JDK {MIN_MAJOR}+ (e.g. jenv install 21 / Temurin 21). Project code can still target Java 17."
    ))
}

fn find_java_runtime_at_least(min_major: u32) -> Option<DetectedJavaRuntime> {
    let mut candidates: Vec<PathBuf> = Vec::new();

    if let Ok(home) = user_home_dir() {
        let jenv_versions = home.join(".jenv").join("versions");
        if let Ok(entries) = fs::read_dir(&jenv_versions) {
            for entry in entries.filter_map(Result::ok) {
                candidates.push(entry.path());
            }
        }
        let jvms = home
            .join("Library")
            .join("Java")
            .join("JavaVirtualMachines");
        if let Ok(entries) = fs::read_dir(jvms) {
            for entry in entries.filter_map(Result::ok) {
                candidates.push(entry.path().join("Contents").join("Home"));
                candidates.push(entry.path());
            }
        }
    }

    if cfg!(target_os = "macos") {
        let jvms = PathBuf::from("/Library/Java/JavaVirtualMachines");
        if let Ok(entries) = fs::read_dir(jvms) {
            for entry in entries.filter_map(Result::ok) {
                candidates.push(entry.path().join("Contents").join("Home"));
            }
        }
        // Explicit version probes via java_home.
        for version in [min_major, min_major + 1, min_major + 2, 25] {
            if let Ok(output) = Command::new("/usr/libexec/java_home")
                .arg("-v")
                .arg(version.to_string())
                .output()
            {
                if output.status.success() {
                    let home = PathBuf::from(String::from_utf8_lossy(&output.stdout).trim());
                    candidates.push(home);
                }
            }
        }
    }

    let mut best: Option<(u32, DetectedJavaRuntime)> = None;
    for path in candidates {
        let Some(runtime) = runtime_from_home(path, "jdt_ls") else {
            continue;
        };
        let Some(major) = runtime.version.as_deref().and_then(parse_java_major) else {
            continue;
        };
        if major < min_major {
            continue;
        }
        match &best {
            None => best = Some((major, runtime)),
            Some((current, _)) if major >= *current => best = Some((major, runtime)),
            _ => {}
        }
    }
    best.map(|(_, runtime)| runtime)
}

fn jdt_workspace_data_dir(repo_root: &Path) -> Result<PathBuf, String> {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    let mut hasher = DefaultHasher::new();
    repo_root.to_string_lossy().hash(&mut hasher);
    let hash = format!("{:x}", hasher.finish());
    let dir = user_home_dir()?
        .join(".gitnest")
        .join("jdtls-workspaces")
        .join(&hash);
    fs::create_dir_all(&dir).map_err(|error| error.to_string())?;
    Ok(dir)
}

fn writable_jdt_configuration(jdt_ls: &Path) -> Result<PathBuf, String> {
    let source = configuration_dir(jdt_ls)?;
    let name = source
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("config");
    let dest = user_home_dir()?
        .join(".gitnest")
        .join("jdtls-config")
        .join(name);
    fs::create_dir_all(&dest).map_err(|error| error.to_string())?;
    let dest_ini = dest.join("config.ini");
    let source_ini = source.join("config.ini");
    if !dest_ini.exists() {
        if source_ini.exists() {
            fs::copy(&source_ini, &dest_ini).map_err(|error| error.to_string())?;
        }
        let source_settings = source.join(".settings");
        let dest_settings = dest.join(".settings");
        if source_settings.is_dir() && !dest_settings.exists() {
            copy_dir_recursive(&source_settings, &dest_settings)?;
        }
    }
    Ok(dest)
}

fn copy_dir_recursive(from: &Path, to: &Path) -> Result<(), String> {
    fs::create_dir_all(to).map_err(|error| error.to_string())?;
    for entry in fs::read_dir(from).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        let src = entry.path();
        let dst = to.join(entry.file_name());
        if src.is_dir() {
            copy_dir_recursive(&src, &dst)?;
        } else {
            fs::copy(&src, &dst).map_err(|error| error.to_string())?;
        }
    }
    Ok(())
}

fn resolve_home_from_java_binary(java_exec: &Path) -> Option<PathBuf> {
    let output = Command::new(java_exec)
        .args(["-XshowSettings:properties", "-version"])
        .output()
        .ok()?;
    let text = format!(
        "{}\n{}",
        String::from_utf8_lossy(&output.stderr),
        String::from_utf8_lossy(&output.stdout)
    );
    for line in text.lines() {
        let trimmed = line.trim();
        if let Some(value) = trimmed.strip_prefix("java.home =") {
            let home = PathBuf::from(value.trim());
            let home = normalize_java_home(&home);
            if java_home_looks_valid(&home) {
                return Some(home);
            }
        }
    }
    java_exec
        .parent()
        .and_then(|bin| bin.parent())
        .map(normalize_java_home)
        .filter(|home| java_home_looks_valid(home))
}

fn detect_macos_java_home() -> Option<PathBuf> {
    if !cfg!(target_os = "macos") {
        return None;
    }
    let output = Command::new("/usr/libexec/java_home").output().ok()?;
    if !output.status.success() {
        return None;
    }
    let home = PathBuf::from(String::from_utf8_lossy(&output.stdout).trim());
    let home = normalize_java_home(&home);
    java_home_looks_valid(&home).then_some(home)
}

fn detect_env_java_home() -> Option<PathBuf> {
    let value = std::env::var("JAVA_HOME").ok()?;
    let home = normalize_java_home(Path::new(value.trim()));
    java_home_looks_valid(&home).then_some(home)
}

fn detect_jenv_java_home() -> Option<PathBuf> {
    let home = user_home_dir().ok()?;
    let jenv_root = home.join(".jenv");
    if !jenv_root.is_dir() {
        return None;
    }

    // Prefer `jenv prefix` when available (respects local/global version).
    let mut cmd = Command::new(jenv_root.join("bin").join("jenv"));
    if !cmd.get_program().is_empty() && Path::new(cmd.get_program()).exists() {
        cmd.arg("prefix");
        cmd.env("PATH", enriched_path());
        cmd.env("JENV_ROOT", &jenv_root);
        if let Ok(output) = cmd.output() {
            if output.status.success() {
                let prefix = PathBuf::from(String::from_utf8_lossy(&output.stdout).trim());
                let prefix = normalize_java_home(&prefix);
                if java_home_looks_valid(&prefix) {
                    return Some(prefix);
                }
            }
        }
    }

    // Fallback: ~/.jenv/version → ~/.jenv/versions/<ver>
    let version = fs::read_to_string(jenv_root.join("version"))
        .ok()?
        .lines()
        .next()?
        .trim()
        .to_string();
    if version.is_empty() {
        return None;
    }
    let mut candidates = vec![
        jenv_root.join("versions").join(&version),
        jenv_root
            .join("versions")
            .join(format!("oracle64-{version}")),
        jenv_root
            .join("versions")
            .join(format!("corretto64-{version}")),
    ];
    // Partial match: "17" → newest 17.x
    if let Ok(entries) = fs::read_dir(jenv_root.join("versions")) {
        let mut matches: Vec<PathBuf> = entries
            .filter_map(Result::ok)
            .map(|entry| entry.path())
            .filter(|path| {
                path.file_name()
                    .and_then(|name| name.to_str())
                    .is_some_and(|name| name == version || name.starts_with(&format!("{version}.")))
            })
            .collect();
        matches.sort();
        candidates.extend(matches.into_iter().rev());
    }
    candidates
        .into_iter()
        .map(|path| normalize_java_home(&path))
        .find(|path| java_home_looks_valid(path))
}

fn detect_login_shell_java_home() -> Option<PathBuf> {
    let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".into());
    let script = r#"
if [ -n "$JAVA_HOME" ] && [ -x "$JAVA_HOME/bin/java" ]; then
  printf '%s\n' "$JAVA_HOME"
  exit 0
fi
if command -v jenv >/dev/null 2>&1; then
  prefix="$(jenv prefix 2>/dev/null || true)"
  if [ -n "$prefix" ] && [ -x "$prefix/bin/java" ]; then
    printf '%s\n' "$prefix"
    exit 0
  fi
fi
java -XshowSettings:properties -version 2>&1 | awk -F' = ' '/^[[:space:]]*java\.home[[:space:]]*=/ {print $2; exit}'
"#;
    let output = Command::new(&shell)
        .args(["-l", "-c", script])
        .env("PATH", enriched_path())
        .output()
        .ok()?;
    if !output.status.success() && output.stdout.is_empty() {
        return None;
    }
    let home = PathBuf::from(String::from_utf8_lossy(&output.stdout).trim());
    let home = normalize_java_home(&home);
    java_home_looks_valid(&home).then_some(home)
}

fn is_macos_java_stub(path: &Path) -> bool {
    cfg!(target_os = "macos")
        && path
            .to_str()
            .is_some_and(|value| value == "/usr/bin/java" || value.ends_with("/usr/bin/java"))
}

fn detect_path_java_home() -> Option<PathBuf> {
    let java_exec = which_with_enriched_path("java")?;
    // /usr/bin/java is a macOS stub that picks the newest JDK via java_home — skip it.
    if is_macos_java_stub(&java_exec) {
        return None;
    }
    resolve_home_from_java_binary(&java_exec)
}

/// Resolve which JDK to use: manual setting wins, otherwise the same JDK as the user terminal (jenv / PATH).
pub fn resolve_java_runtime(manual_java_home: &str) -> DetectedJavaRuntime {
    let manual = manual_java_home.trim();
    if !manual.is_empty() {
        let home = normalize_java_home(Path::new(manual));
        let executable = home.join("bin").join(java_bin_name());
        return DetectedJavaRuntime {
            home: home.to_string_lossy().into_owned(),
            executable: executable.to_string_lossy().into_owned(),
            version: read_java_version(&executable),
            source: "manual".into(),
        };
    }

    // Match terminal/jenv first — never prefer newest /usr/libexec/java_home over the active JDK.
    let detected = detect_jenv_java_home()
        .map(|home| (home, "path"))
        .or_else(|| detect_login_shell_java_home().map(|home| (home, "path")))
        .or_else(|| detect_path_java_home().map(|home| (home, "path")))
        .or_else(|| detect_env_java_home().map(|home| (home, "java_home")))
        .or_else(|| detect_macos_java_home().map(|home| (home, "macos")));

    if let Some((home, source)) = detected {
        let executable = home.join("bin").join(java_bin_name());
        return DetectedJavaRuntime {
            home: home.to_string_lossy().into_owned(),
            executable: executable.to_string_lossy().into_owned(),
            version: read_java_version(&executable),
            source: source.into(),
        };
    }

    DetectedJavaRuntime {
        home: String::new(),
        executable: java_bin_name().to_string(),
        version: None,
        source: "none".into(),
    }
}

/// GUI apps on macOS often miss Homebrew/jenv PATH from the login shell.
fn enriched_path() -> String {
    let mut dirs: Vec<PathBuf> = Vec::new();
    if let Ok(home) = user_home_dir() {
        dirs.push(home.join(".jenv").join("shims"));
        dirs.push(home.join(".jenv").join("bin"));
        dirs.push(
            home.join(".sdkman")
                .join("candidates")
                .join("java")
                .join("current")
                .join("bin"),
        );
        dirs.push(
            home.join(".sdkman")
                .join("candidates")
                .join("maven")
                .join("current")
                .join("bin"),
        );
        dirs.push(home.join(".local").join("bin"));
    }
    dirs.push(PathBuf::from("/opt/homebrew/bin"));
    dirs.push(PathBuf::from("/opt/homebrew/sbin"));
    dirs.push(PathBuf::from("/usr/local/bin"));
    dirs.push(PathBuf::from("/usr/local/sbin"));
    if let Ok(path) = std::env::var("PATH") {
        for part in path.split(':') {
            if !part.is_empty() {
                dirs.push(PathBuf::from(part));
            }
        }
    }
    let mut seen = std::collections::HashSet::new();
    let mut ordered = Vec::new();
    for dir in dirs {
        let key = dir.to_string_lossy().into_owned();
        if seen.insert(key.clone()) {
            ordered.push(key);
        }
    }
    ordered.join(":")
}

fn login_shell_which(command: &str) -> Option<PathBuf> {
    let shell = std::env::var("SHELL").unwrap_or_else(|_| {
        if cfg!(windows) {
            "cmd.exe".into()
        } else {
            "/bin/zsh".into()
        }
    });
    let script = if cfg!(windows) {
        format!("where {command}")
    } else {
        format!("command -v {command} || which {command}")
    };
    let mut cmd = Command::new(&shell);
    if cfg!(windows) {
        cmd.args(["/C", &script]);
    } else {
        cmd.args(["-l", "-c", &script]);
        cmd.env("PATH", enriched_path());
    }
    let output = cmd.output().ok()?;
    if !output.status.success() {
        return None;
    }
    let first = String::from_utf8_lossy(&output.stdout)
        .lines()
        .next()?
        .trim()
        .to_string();
    if first.is_empty() {
        return None;
    }
    let path = PathBuf::from(first);
    path.exists().then_some(path)
}

fn which_with_enriched_path(command: &str) -> Option<PathBuf> {
    if let Some(path) = login_shell_which(command) {
        return Some(path);
    }
    let output = if cfg!(windows) {
        Command::new("where").arg(command).output().ok()?
    } else {
        let mut cmd = Command::new("which");
        cmd.arg(command);
        cmd.env("PATH", enriched_path());
        cmd.output().ok()?
    };
    if !output.status.success() {
        return None;
    }
    let first = String::from_utf8_lossy(&output.stdout)
        .lines()
        .next()?
        .trim()
        .to_string();
    if first.is_empty() {
        return None;
    }
    let path = PathBuf::from(first);
    path.exists().then_some(path)
}

fn mvn_bin_name() -> &'static str {
    if cfg!(windows) {
        "mvn.cmd"
    } else {
        "mvn"
    }
}

fn maven_home_looks_valid(home: &Path) -> bool {
    home.join("bin").join(mvn_bin_name()).is_file() || home.join("bin").join("mvn").is_file()
}

fn read_maven_version(mvn_exec: &Path) -> Option<String> {
    let mut cmd = Command::new(mvn_exec);
    cmd.arg("-version");
    cmd.env("PATH", enriched_path());
    let output = cmd.output().ok()?;
    let text = format!(
        "{}\n{}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );
    text.lines()
        .find(|line| line.contains("Apache Maven"))
        .map(|line| line.trim().to_string())
}

fn resolve_maven_home_from_mvn(mvn_exec: &Path) -> Option<PathBuf> {
    let mut cmd = Command::new(mvn_exec);
    cmd.arg("-version");
    cmd.env("PATH", enriched_path());
    let output = cmd.output().ok()?;
    let text = format!(
        "{}\n{}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );
    for line in text.lines() {
        let trimmed = line.trim();
        if let Some(value) = trimmed
            .strip_prefix("Maven home:")
            .or_else(|| trimmed.strip_prefix("Maven home："))
        {
            let home = PathBuf::from(value.trim());
            if maven_home_looks_valid(&home) {
                return Some(home);
            }
        }
    }
    // Avoid treating jenv/sdkman shim dirs as Maven home.
    mvn_exec
        .parent()
        .and_then(|bin| bin.parent())
        .filter(|home| {
            let name = home
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or_default();
            !name.eq_ignore_ascii_case("jenv")
                && !name.eq_ignore_ascii_case("shims")
                && maven_home_looks_valid(home)
        })
        .map(|home| home.to_path_buf())
}

fn detect_env_m2_home() -> Option<PathBuf> {
    for key in ["M2_HOME", "MAVEN_HOME"] {
        if let Ok(value) = std::env::var(key) {
            let home = PathBuf::from(value.trim());
            if maven_home_looks_valid(&home) {
                return Some(home);
            }
        }
    }
    None
}

fn detect_common_maven_homes() -> Option<PathBuf> {
    let mut candidates = Vec::new();
    if let Ok(home) = user_home_dir() {
        candidates.push(
            home.join(".sdkman")
                .join("candidates")
                .join("maven")
                .join("current"),
        );
    }
    for root in [
        PathBuf::from("/opt/homebrew/opt/maven/libexec"),
        PathBuf::from("/usr/local/opt/maven/libexec"),
        PathBuf::from("/opt/homebrew/Cellar/maven"),
        PathBuf::from("/usr/local/Cellar/maven"),
    ] {
        if root.join("bin").join(mvn_bin_name()).is_file() || root.join("bin").join("mvn").is_file()
        {
            candidates.push(root.clone());
        } else if root.is_dir() {
            if let Ok(entries) = fs::read_dir(&root) {
                let mut versions: Vec<PathBuf> = entries
                    .filter_map(Result::ok)
                    .map(|entry| entry.path().join("libexec"))
                    .filter(|path| maven_home_looks_valid(path))
                    .collect();
                versions.sort();
                candidates.extend(versions);
            }
        }
    }
    candidates
        .into_iter()
        .rev()
        .find(|path| maven_home_looks_valid(path))
}

fn detect_path_maven_home() -> Option<PathBuf> {
    let mvn_exec = which_with_enriched_path("mvn")?;
    resolve_maven_home_from_mvn(&mvn_exec)
}

fn maven_settings_paths(home: &Path) -> (Option<String>, Option<String>) {
    let global = home.join("conf").join("settings.xml");
    let global_settings = global
        .is_file()
        .then(|| global.to_string_lossy().into_owned());
    let user = user_home_dir()
        .ok()
        .map(|h| h.join(".m2").join("settings.xml"))
        .filter(|path| path.is_file())
        .map(|path| path.to_string_lossy().into_owned());
    (global_settings, user)
}

/// Resolve Maven install: manual setting wins, otherwise system default (login-shell PATH).
pub fn resolve_maven_runtime(manual_maven_home: &str) -> DetectedMavenRuntime {
    let manual = manual_maven_home.trim();
    if !manual.is_empty() {
        let home = PathBuf::from(manual);
        let executable = home.join("bin").join(mvn_bin_name());
        let (global_settings, user_settings) = maven_settings_paths(&home);
        return DetectedMavenRuntime {
            home: home.to_string_lossy().into_owned(),
            executable: executable.to_string_lossy().into_owned(),
            version: read_maven_version(&executable),
            source: "manual".into(),
            global_settings,
            user_settings,
        };
    }

    if let Some(home) = detect_path_maven_home() {
        let executable = home.join("bin").join(mvn_bin_name());
        let (global_settings, user_settings) = maven_settings_paths(&home);
        return DetectedMavenRuntime {
            home: home.to_string_lossy().into_owned(),
            executable: executable.to_string_lossy().into_owned(),
            version: read_maven_version(&executable),
            source: "path".into(),
            global_settings,
            user_settings,
        };
    }

    if let Some(home) = detect_env_m2_home() {
        let executable = home.join("bin").join(mvn_bin_name());
        let (global_settings, user_settings) = maven_settings_paths(&home);
        let source = if std::env::var("M2_HOME")
            .map(|value| PathBuf::from(value.trim()) == home)
            .unwrap_or(false)
        {
            "m2_home"
        } else {
            "maven_home"
        };
        return DetectedMavenRuntime {
            home: home.to_string_lossy().into_owned(),
            executable: executable.to_string_lossy().into_owned(),
            version: read_maven_version(&executable),
            source: source.into(),
            global_settings,
            user_settings,
        };
    }

    if let Some(home) = detect_common_maven_homes() {
        let executable = home.join("bin").join(mvn_bin_name());
        let (global_settings, user_settings) = maven_settings_paths(&home);
        return DetectedMavenRuntime {
            home: home.to_string_lossy().into_owned(),
            executable: executable.to_string_lossy().into_owned(),
            version: read_maven_version(&executable),
            source: "path".into(),
            global_settings,
            user_settings,
        };
    }

    DetectedMavenRuntime {
        home: String::new(),
        executable: mvn_bin_name().to_string(),
        version: None,
        source: "none".into(),
        global_settings: None,
        user_settings: user_home_dir()
            .ok()
            .map(|h| h.join(".m2").join("settings.xml"))
            .filter(|path| path.is_file())
            .map(|path| path.to_string_lossy().into_owned()),
    }
}

fn build_lsp_env(java_home: &str, maven: &DetectedMavenRuntime) -> Vec<(String, String)> {
    let mut env = vec![("JAVA_HOME".to_string(), java_home.to_string())];
    let mut path = enriched_path();
    if !maven.home.is_empty() && maven.source != "none" {
        env.push(("M2_HOME".to_string(), maven.home.clone()));
        env.push(("MAVEN_HOME".to_string(), maven.home.clone()));
        let mvn_bin = PathBuf::from(&maven.home).join("bin");
        let sep = if cfg!(windows) { ";" } else { ":" };
        path = format!("{}{}{}", mvn_bin.display(), sep, path);
    }
    env.push(("PATH".to_string(), path));
    env
}

fn launcher_jar(jdt_ls: &Path) -> Result<PathBuf, String> {
    let plugins = jdt_ls.join("plugins");
    let mut launchers: Vec<_> = fs::read_dir(&plugins)
        .map_err(|_| format!("JDT LS plugins directory not found: {}", plugins.display()))?
        .filter_map(Result::ok)
        .map(|entry| entry.path())
        .filter(|path| {
            path.file_name()
                .and_then(|name| name.to_str())
                .is_some_and(|name| {
                    name.starts_with("org.eclipse.equinox.launcher_") && name.ends_with(".jar")
                })
        })
        .collect();
    launchers.sort();
    launchers
        .pop()
        .ok_or_else(|| "JDT LS launcher jar was not found".to_string())
}

fn jdt_ls_looks_valid(jdt_ls: &Path) -> bool {
    launcher_jar(jdt_ls).is_ok() && configuration_dir(jdt_ls).is_ok()
}

fn configuration_dir(jdt_ls: &Path) -> Result<PathBuf, String> {
    let candidates: &[&str] = if cfg!(all(target_os = "macos", target_arch = "aarch64")) {
        &["config_mac_arm", "config_mac"]
    } else if cfg!(target_os = "macos") {
        &["config_mac", "config_mac_arm"]
    } else if cfg!(windows) {
        &["config_win"]
    } else if cfg!(target_arch = "aarch64") {
        &["config_linux_arm", "config_linux"]
    } else {
        &["config_linux", "config_linux_arm"]
    };
    for name in candidates {
        let path = jdt_ls.join(name);
        if path.is_dir() {
            return Ok(path);
        }
    }
    Err(format!(
        "JDT LS configuration directory not found under {}",
        jdt_ls.display()
    ))
}

fn user_home_dir() -> Result<PathBuf, String> {
    if let Ok(home) = std::env::var("HOME") {
        let path = PathBuf::from(home.trim());
        if !path.as_os_str().is_empty() {
            return Ok(path);
        }
    }
    if cfg!(windows) {
        if let Ok(home) = std::env::var("USERPROFILE") {
            let path = PathBuf::from(home.trim());
            if !path.as_os_str().is_empty() {
                return Ok(path);
            }
        }
    }
    Err("Unable to resolve user home directory".into())
}

/// Managed install root: `~/.gitnest/plugins/jdtls`
pub fn managed_jdt_ls_dir() -> Result<PathBuf, String> {
    Ok(user_home_dir()?
        .join(".gitnest")
        .join("plugins")
        .join("jdtls"))
}

const JDTLS_LATEST_URL: &str =
    "https://download.eclipse.org/jdtls/snapshots/jdt-language-server-latest.tar.gz";
const JDTLS_LATEST_NAME_URL: &str = "https://download.eclipse.org/jdtls/snapshots/latest.txt";

fn http_get_bytes(url: &str) -> Result<Vec<u8>, String> {
    let response = ureq::get(url)
        .set("User-Agent", "GitNest")
        .call()
        .map_err(|error| format!("Download failed ({url}): {error}"))?;
    let mut body = Vec::new();
    response
        .into_reader()
        .read_to_end(&mut body)
        .map_err(|error| format!("Failed reading download body ({url}): {error}"))?;
    Ok(body)
}

fn http_get_text(url: &str) -> Result<String, String> {
    let bytes = http_get_bytes(url)?;
    String::from_utf8(bytes).map_err(|error| format!("Invalid response encoding: {error}"))
}

fn remove_path_if_exists(path: &Path) -> Result<(), String> {
    if !path.exists() {
        return Ok(());
    }
    if path.is_dir() {
        fs::remove_dir_all(path).map_err(|error| error.to_string())
    } else {
        fs::remove_file(path).map_err(|error| error.to_string())
    }
}

/// Download and extract Eclipse JDT LS into `~/.gitnest/plugins/jdtls`.
pub fn install_managed_jdt_ls() -> Result<PathBuf, String> {
    let target = managed_jdt_ls_dir()?;
    let plugins_root = target
        .parent()
        .ok_or_else(|| "Invalid managed JDT LS path".to_string())?
        .to_path_buf();
    fs::create_dir_all(&plugins_root).map_err(|error| error.to_string())?;

    let archive_name = http_get_text(JDTLS_LATEST_NAME_URL)?
        .lines()
        .next()
        .unwrap_or("jdt-language-server-latest.tar.gz")
        .trim()
        .to_string();
    let version_marker = target.join(".gitnest-jdtls-version");
    if jdt_ls_looks_valid(&target) {
        if let Ok(current) = fs::read_to_string(&version_marker) {
            if current.trim() == archive_name {
                return Ok(target);
            }
        } else {
            // Already installed from a previous run without a marker — reuse it.
            return Ok(target);
        }
    }

    tracing::info!(%archive_name, path = %target.display(), "Installing managed Eclipse JDT LS");
    let archive_bytes = http_get_bytes(JDTLS_LATEST_URL)?;
    let staging = plugins_root.join(format!("jdtls-staging-{}", std::process::id()));
    remove_path_if_exists(&staging)?;
    fs::create_dir_all(&staging).map_err(|error| error.to_string())?;

    {
        let decoder = flate2::read::GzDecoder::new(std::io::Cursor::new(archive_bytes));
        let mut archive = tar::Archive::new(decoder);
        archive
            .unpack(&staging)
            .map_err(|error| format!("Failed to extract JDT LS archive: {error}"))?;
    }

    if !jdt_ls_looks_valid(&staging) {
        remove_path_if_exists(&staging)?;
        return Err(format!(
            "Downloaded JDT LS archive is invalid (expected plugins/ and config_* under {})",
            staging.display()
        ));
    }

    let backup = plugins_root.join(format!("jdtls-backup-{}", std::process::id()));
    remove_path_if_exists(&backup)?;
    if target.exists() {
        fs::rename(&target, &backup).map_err(|error| error.to_string())?;
    }
    if let Err(error) = fs::rename(&staging, &target) {
        if backup.exists() {
            let _ = fs::rename(&backup, &target);
        }
        remove_path_if_exists(&staging)?;
        return Err(format!(
            "Failed to activate managed JDT LS install: {error}"
        ));
    }
    remove_path_if_exists(&backup)?;
    fs::write(&version_marker, format!("{archive_name}\n")).map_err(|error| error.to_string())?;
    tracing::info!(path = %target.display(), "Managed Eclipse JDT LS ready");
    Ok(target)
}

/// Ensure managed JDT LS exists; install on first use when path is empty.
pub fn ensure_jdt_ls(manual_path: &str) -> Result<DetectedJdtLs, String> {
    let manual = manual_path.trim();
    if !manual.is_empty() {
        let path = PathBuf::from(manual);
        if !jdt_ls_looks_valid(&path) {
            return Err(format!(
                "Configured JDT LS is invalid (need plugins/ and config_*): {}",
                path.display()
            ));
        }
        return Ok(DetectedJdtLs {
            path: path.to_string_lossy().into_owned(),
            source: "manual".into(),
            valid: true,
            needs_install: false,
        });
    }

    let managed = managed_jdt_ls_dir()?;
    if jdt_ls_looks_valid(&managed) {
        return Ok(DetectedJdtLs {
            path: managed.to_string_lossy().into_owned(),
            source: "managed".into(),
            valid: true,
            needs_install: false,
        });
    }

    let installed = install_managed_jdt_ls()?;
    Ok(DetectedJdtLs {
        path: installed.to_string_lossy().into_owned(),
        source: "managed".into(),
        valid: true,
        needs_install: false,
    })
}

/// Resolve without downloading (for status / settings preview).
pub fn resolve_jdt_ls(manual_path: &str) -> DetectedJdtLs {
    let manual = manual_path.trim();
    if !manual.is_empty() {
        let path = PathBuf::from(manual);
        return DetectedJdtLs {
            path: path.to_string_lossy().into_owned(),
            source: "manual".into(),
            valid: jdt_ls_looks_valid(&path),
            needs_install: false,
        };
    }

    match managed_jdt_ls_dir() {
        Ok(path) => {
            let valid = jdt_ls_looks_valid(&path);
            DetectedJdtLs {
                path: path.to_string_lossy().into_owned(),
                source: "managed".into(),
                valid,
                needs_install: !valid,
            }
        }
        Err(_) => DetectedJdtLs {
            path: String::new(),
            source: "none".into(),
            valid: false,
            needs_install: true,
        },
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DetectedJdtLs {
    pub path: String,
    /// `manual` | `managed` | `none`
    pub source: String,
    pub valid: bool,
    pub needs_install: bool,
}

#[tauri::command]
pub async fn detect_java_runtime() -> DetectedJavaRuntime {
    // Always report the system default for UI; manual override is separate.
    // Run off the async runtime so opening Settings does not stall the UI thread.
    tauri::async_runtime::spawn_blocking(|| resolve_java_runtime(""))
        .await
        .unwrap_or_else(|_| DetectedJavaRuntime {
            home: String::new(),
            executable: String::new(),
            version: None,
            source: "none".into(),
        })
}

#[tauri::command]
pub async fn detect_maven_runtime() -> DetectedMavenRuntime {
    tauri::async_runtime::spawn_blocking(|| resolve_maven_runtime(""))
        .await
        .unwrap_or_else(|_| DetectedMavenRuntime {
            home: String::new(),
            executable: String::new(),
            version: None,
            source: "none".into(),
            global_settings: None,
            user_settings: None,
        })
}

#[tauri::command]
pub async fn detect_jdt_ls() -> DetectedJdtLs {
    tauri::async_runtime::spawn_blocking(|| resolve_jdt_ls(""))
        .await
        .unwrap_or_else(|_| DetectedJdtLs {
            path: String::new(),
            source: "none".into(),
            valid: false,
            needs_install: true,
        })
}

#[tauri::command]
pub async fn java_lsp_status(state: State<'_, SharedState>) -> Result<JavaLspStatus, String> {
    let settings = state.settings_snapshot();
    let root = state.workspace.root().ok();
    tauri::async_runtime::spawn_blocking(move || java_lsp_status_inner(settings, root))
        .await
        .map_err(|error| error.to_string())
}

fn java_lsp_status_inner(
    settings: rebased_core::AppSettings,
    root: Option<PathBuf>,
) -> JavaLspStatus {
    let runtime = resolve_java_runtime(&settings.java_home);
    let maven = resolve_maven_runtime(&settings.maven_home);
    let jdt = resolve_jdt_ls(&settings.jdt_ls_path);
    let mut error = None;
    if runtime.source == "none" || runtime.home.is_empty() {
        error = Some("No JDK found. Install a JDK or choose one manually.".into());
    } else if !Path::new(&runtime.executable).exists() && runtime.source == "manual" {
        error = Some(format!("Configured JDK not found: {}", runtime.home));
    } else if maven.source == "manual" && !maven_home_looks_valid(Path::new(&maven.home)) {
        error = Some(format!(
            "Configured Maven not found (need bin/{}): {}",
            mvn_bin_name(),
            maven.home
        ));
    } else if jdt.source == "manual" && !jdt.valid {
        error = Some(format!(
            "Configured JDT LS is invalid (need plugins/ and config_*): {}",
            jdt.path
        ));
    }
    // Managed path may still need first-run download; that is not an error.
    if error.is_none() {
        if let Err(message) = resolve_jdt_ls_runtime(&runtime) {
            error = Some(message);
        }
    }
    let has_workspace_cache = root
        .and_then(|root| jdt_workspace_data_dir(&root).ok())
        .map(|data| {
            data.join(".metadata").is_dir()
                || data
                    .read_dir()
                    .map(|mut entries| entries.next().is_some())
                    .unwrap_or(false)
        })
        .unwrap_or(false);
    JavaLspStatus {
        available: error.is_none(),
        java_executable: runtime.executable,
        java_home: runtime.home,
        java_version: runtime.version,
        java_source: runtime.source,
        maven_home: maven.home,
        maven_executable: maven.executable,
        maven_version: maven.version,
        maven_source: maven.source,
        maven_global_settings: maven.global_settings,
        maven_user_settings: maven.user_settings,
        jdt_ls_path: jdt.path,
        needs_install: jdt.needs_install,
        has_workspace_cache,
        error,
    }
}

#[tauri::command]
pub async fn java_lsp_start(app: AppHandle, state: State<'_, SharedState>) -> Result<u64, String> {
    let settings = state.settings_snapshot();
    let root = state.workspace.root()?;
    let lsp = state.lsp.clone();

    tauri::async_runtime::spawn_blocking(move || {
        let project_runtime = resolve_java_runtime(&settings.java_home);
        if project_runtime.home.is_empty() || project_runtime.source == "none" {
            return Err(
                "No JDK found. Install a JDK or choose one manually in Settings → Java.".into(),
            );
        }
        // Language server process needs JDK 21+; project may still compile with 17.
        let runtime = resolve_jdt_ls_runtime(&project_runtime)?;
        let java = PathBuf::from(&runtime.executable);
        if !java.exists() {
            return Err(format!("JDK for JDT LS not found: {}", runtime.home));
        }

        let maven = resolve_maven_runtime(&settings.maven_home);
        if maven.source == "manual" && !maven_home_looks_valid(Path::new(&maven.home)) {
            return Err(format!(
                "Configured Maven not found (need bin/{}): {}",
                mvn_bin_name(),
                maven.home
            ));
        }

        let jdt = ensure_jdt_ls(&settings.jdt_ls_path)?;
        let jdt_ls = PathBuf::from(&jdt.path);
        let launcher = launcher_jar(&jdt_ls)?;
        // Writable config copy — never mutate the shared install config.
        let configuration = writable_jdt_configuration(&jdt_ls)?;
        // Data dir must NOT live inside the project (Eclipse rejects overlapping paths).
        let data = jdt_workspace_data_dir(&root)?;
        let args = vec![
            "-Declipse.application=org.eclipse.jdt.ls.core.id1".to_string(),
            "-Dosgi.bundles.defaultStartLevel=4".to_string(),
            "-Declipse.product=org.eclipse.jdt.ls.core.product".to_string(),
            "-Dlog.protocol=true".to_string(),
            "-Dlog.level=INFO".to_string(),
            "-Xms64m".to_string(),
            "-Xmx768m".to_string(),
            "-XX:+UseG1GC".to_string(),
            "-XX:MaxGCPauseMillis=50".to_string(),
            "-jar".to_string(),
            launcher.to_string_lossy().into_owned(),
            "-configuration".to_string(),
            configuration.to_string_lossy().into_owned(),
            "-data".to_string(),
            data.to_string_lossy().into_owned(),
        ];
        // Keep project JDK on PATH for builds, but run the server JVM with 21+.
        let env = build_lsp_env(&runtime.home, &maven);
        lsp.start(app, &java, &args, &root, &env)
    })
    .await
    .map_err(|error| error.to_string())?
}

const CFR_JAR_URL: &str = "https://repo1.maven.org/maven2/org/benf/cfr/0.152/cfr-0.152.jar";

fn managed_plugins_dir() -> Result<PathBuf, String> {
    Ok(user_home_dir()?.join(".gitnest").join("plugins"))
}

fn ensure_cfr_jar() -> Result<PathBuf, String> {
    let jar = managed_plugins_dir()?.join("cfr.jar");
    if jar.is_file() && jar.metadata().map(|meta| meta.len() > 0).unwrap_or(false) {
        return Ok(jar);
    }
    fs::create_dir_all(managed_plugins_dir()?).map_err(|error| error.to_string())?;
    tracing::info!(path = %jar.display(), "Downloading CFR decompiler");
    let bytes = http_get_bytes(CFR_JAR_URL)?;
    if bytes.is_empty() {
        return Err("Downloaded CFR jar was empty".into());
    }
    let staging = jar.with_extension("jar.partial");
    fs::write(&staging, &bytes).map_err(|error| error.to_string())?;
    fs::rename(&staging, &jar).map_err(|error| error.to_string())?;
    Ok(jar)
}

fn decompile_with_cfr(java_exec: &Path, class_file: &Path) -> Result<String, String> {
    let jar = ensure_cfr_jar()?;
    let output = Command::new(java_exec)
        .arg("-jar")
        .arg(&jar)
        .arg(class_file)
        .args(["--silent", "true"])
        .output()
        .map_err(|error| format!("Failed to run CFR: {error}"))?;
    let stdout = String::from_utf8_lossy(&output.stdout).into_owned();
    let stderr = String::from_utf8_lossy(&output.stderr);
    if stdout.trim().is_empty() {
        return Err(format!(
            "CFR produced no output (status {}): {stderr}",
            output.status
        ));
    }
    Ok(stdout)
}

fn decompile_with_javap(java_home: &Path, class_file: &Path) -> Result<String, String> {
    let javap = java_home
        .join("bin")
        .join(if cfg!(windows) { "javap.exe" } else { "javap" });
    if !javap.is_file() {
        return Err(format!("javap not found: {}", javap.display()));
    }
    let output = Command::new(&javap)
        .args(["-p", "-c", "-l", "-constants"])
        .arg(class_file)
        .output()
        .map_err(|error| format!("Failed to run javap: {error}"))?;
    let stdout = String::from_utf8_lossy(&output.stdout).into_owned();
    let stderr = String::from_utf8_lossy(&output.stderr);
    if !output.status.success() || stdout.trim().is_empty() {
        return Err(format!("javap failed: {stderr}"));
    }
    Ok(format!(
        "// Decompiled with javap (bytecode view)\n// {}\n\n{stdout}",
        class_file.display()
    ))
}

fn resolve_class_file_path(path: &str, workspace_root: Option<&Path>) -> Result<PathBuf, String> {
    let candidate = PathBuf::from(path);
    let abs = if candidate.is_absolute() {
        candidate
    } else {
        let root = workspace_root.ok_or_else(|| "No project is open".to_string())?;
        root.join(path)
    };
    if !abs.is_file() {
        return Err(format!("Class file not found: {}", abs.display()));
    }
    if !abs
        .extension()
        .and_then(|ext| ext.to_str())
        .is_some_and(|ext| ext.eq_ignore_ascii_case("class"))
    {
        return Err("Not a .class file".into());
    }
    Ok(abs)
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DecompiledClass {
    content: String,
    path: String,
    size_bytes: u64,
}

/// Decompile a local `.class` file for read-only viewing (CFR, fallback javap).
#[tauri::command]
pub async fn decompile_class_file(
    path: String,
    state: State<'_, SharedState>,
) -> Result<DecompiledClass, String> {
    let settings = state.settings_snapshot();
    let root = state.workspace.root().ok();
    let abs = resolve_class_file_path(&path, root.as_deref())?;
    let runtime = resolve_java_runtime(&settings.java_home);
    if runtime.home.is_empty() || runtime.source == "none" {
        return Err(
            "No JDK found. Install a JDK or choose one manually in Settings → Java.".into(),
        );
    }
    let java = PathBuf::from(&runtime.executable);
    let java_home = PathBuf::from(&runtime.home);
    let class_path = abs.clone();
    let content = tauri::async_runtime::spawn_blocking(move || {
        decompile_with_cfr(&java, &class_path).or_else(|cfr_error| {
            tracing::warn!(%cfr_error, "CFR decompile failed; falling back to javap");
            decompile_with_javap(&java_home, &class_path)
                .map_err(|javap_error| format!("{cfr_error}; {javap_error}"))
        })
    })
    .await
    .map_err(|error| error.to_string())??;

    let size_bytes = content.len() as u64;
    Ok(DecompiledClass {
        content,
        path: abs.to_string_lossy().into_owned(),
        size_bytes,
    })
}

#[tauri::command]
pub async fn lsp_send(
    session_id: u64,
    message: Value,
    state: State<'_, SharedState>,
) -> Result<(), String> {
    let lsp = state.lsp.clone();
    tauri::async_runtime::spawn_blocking(move || lsp.send(session_id, &message))
        .await
        .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn lsp_stop(session_id: u64, state: State<'_, SharedState>) -> Result<(), String> {
    let lsp = state.lsp.clone();
    tauri::async_runtime::spawn_blocking(move || lsp.stop(session_id))
        .await
        .map_err(|error| error.to_string())?
}
