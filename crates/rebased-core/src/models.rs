use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RepoInfo {
    pub path: String,
    pub branch: String,
    pub remotes: Vec<RemoteInfo>,
    pub is_bare: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RemoteInfo {
    pub name: String,
    pub url: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum FileStatusKind {
    Modified,
    Added,
    Deleted,
    Renamed,
    Copied,
    Untracked,
    Conflicted,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileChange {
    pub path: String,
    pub old_path: Option<String>,
    pub status: FileStatusKind,
    pub staged: bool,
    #[serde(default)]
    pub additions: Option<u32>,
    #[serde(default)]
    pub deletions: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StatusSnapshot {
    pub staged: Vec<FileChange>,
    pub unstaged: Vec<FileChange>,
    pub untracked: Vec<FileChange>,
    pub conflicted: Vec<FileChange>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiffHunk {
    pub old_start: u32,
    pub old_lines: u32,
    pub new_start: u32,
    pub new_lines: u32,
    pub lines: Vec<DiffLine>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiffLine {
    pub kind: DiffLineKind,
    pub content: String,
    /// 1-based line number in the old file (None for added lines).
    #[serde(default)]
    pub old_lineno: Option<u32>,
    /// 1-based line number in the new file (None for removed lines).
    #[serde(default)]
    pub new_lineno: Option<u32>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum DiffLineKind {
    Context,
    Add,
    Remove,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileDiff {
    pub path: String,
    pub old_path: Option<String>,
    pub hunks: Vec<DiffHunk>,
    pub is_binary: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum FilePreviewKind {
    TextDiff,
    TextContent,
    Image,
    Binary,
    Deleted,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FilePreview {
    pub path: String,
    pub kind: FilePreviewKind,
    pub mime: String,
    pub language: Option<String>,
    pub diff: Option<FileDiff>,
    pub content: Option<String>,
    pub data_base64: Option<String>,
    pub size_bytes: u64,
    pub absolute_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommitEntry {
    pub hash: String,
    pub short_hash: String,
    pub parents: Vec<String>,
    pub author: String,
    pub email: String,
    pub date: i64,
    pub subject: String,
    pub body: String,
    pub refs: Vec<CommitRef>,
    pub graph_row: GraphRow,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommitRef {
    pub name: String,
    /// "head" | "local" | "remote" | "tag"
    pub kind: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GraphRow {
    /// Lane index (top-coordinate space) where this commit's node circle sits.
    pub node_lane: usize,
    /// Resolved hex color of the node.
    pub node_color: String,
    /// True when the commit has more than one parent (a merge).
    pub is_merge: bool,
    /// Number of lanes to reserve horizontal space for in this row.
    pub width: usize,
    /// Connecting line segments drawn within this row.
    pub edges: Vec<GraphEdge>,
}

/// A single connecting segment in the commit graph. Vertical positions are
/// expressed as anchors: 0 = top of the row, 1 = the node center, 2 = bottom.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GraphEdge {
    pub from_lane: usize,
    pub from_y: u8,
    pub to_lane: usize,
    pub to_y: u8,
    pub color: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BranchInfo {
    pub name: String,
    pub is_remote: bool,
    pub is_current: bool,
    pub upstream: Option<String>,
    pub last_commit: Option<String>,
    pub ahead: u32,
    pub behind: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RemoteOperationResult {
    pub success: bool,
    pub output: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StashEntry {
    pub index: u32,
    pub message: String,
    pub branch: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorktreeEntry {
    pub path: String,
    pub branch: Option<String>,
    pub head: String,
    pub is_bare: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RepoOperationState {
    pub merging: bool,
    pub merge_head: Option<String>,
    pub rebasing: bool,
    pub cherry_picking: bool,
    pub reverting: bool,
    pub conflict_count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitHubAccount {
    pub username: String,
    pub token: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitLabAccount {
    pub username: String,
    pub token: String,
    pub host: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PullRequestEntry {
    pub number: u64,
    pub title: String,
    pub state: String,
    pub author: String,
    pub url: String,
    pub head: String,
    pub base: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MergeRequestEntry {
    pub iid: u64,
    pub title: String,
    pub state: String,
    pub author: String,
    pub url: String,
    pub source_branch: String,
    pub target_branch: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommitOptions {
    pub subject: String,
    pub body: String,
    pub amend: bool,
    pub signoff: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub git_ignored: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectTreeRow {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub git_ignored: bool,
    pub depth: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    pub git_path: String,
    #[serde(default)]
    pub auto_fetch_minutes: u32,
    #[serde(default)]
    pub recent_repos: Vec<String>,
    #[serde(default = "default_remote")]
    pub default_remote: String,
    #[serde(default = "default_shell")]
    pub shell_path: String,
    #[serde(default = "default_diff_mode")]
    pub diff_mode: String,
    #[serde(default)]
    pub github_account: Option<GitHubAccount>,
    #[serde(default)]
    pub gitlab_account: Option<GitLabAccount>,
    #[serde(default)]
    pub store_settings_in_project: bool,
    #[serde(default = "default_true")]
    pub confirm_discard: bool,
    #[serde(default = "default_ui_theme")]
    pub ui_theme: String,
    #[serde(default = "default_ui_language")]
    pub ui_language: String,
    #[serde(default)]
    pub java_home: String,
    #[serde(default)]
    pub jdt_ls_path: String,
    #[serde(default)]
    pub maven_home: String,
}

fn default_ui_theme() -> String {
    "dark".into()
}

fn default_ui_language() -> String {
    "en".into()
}

fn default_remote() -> String {
    "origin".into()
}
fn default_diff_mode() -> String {
    "unified".into()
}
fn default_true() -> bool {
    true
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            git_path: "git".into(),
            auto_fetch_minutes: 0,
            recent_repos: Vec::new(),
            default_remote: default_remote(),
            shell_path: default_shell(),
            diff_mode: default_diff_mode(),
            github_account: None,
            gitlab_account: None,
            store_settings_in_project: false,
            confirm_discard: true,
            ui_theme: default_ui_theme(),
            ui_language: default_ui_language(),
            java_home: String::new(),
            jdt_ls_path: String::new(),
            maven_home: String::new(),
        }
    }
}

fn default_shell() -> String {
    if cfg!(windows) {
        "powershell.exe".into()
    } else {
        std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".into())
    }
}
