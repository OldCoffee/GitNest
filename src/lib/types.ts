export type FileStatusKind =
  | "modified"
  | "added"
  | "deleted"
  | "renamed"
  | "copied"
  | "untracked"
  | "conflicted";

export interface RemoteInfo {
  name: string;
  url: string;
}

export interface RepoInfo {
  path: string;
  branch: string;
  remotes: RemoteInfo[];
  is_bare: boolean;
}

export interface FileChange {
  path: string;
  old_path: string | null;
  status: FileStatusKind;
  staged: boolean;
}

export interface StatusSnapshot {
  staged: FileChange[];
  unstaged: FileChange[];
  untracked: FileChange[];
  conflicted: FileChange[];
}

export type DiffLineKind = "context" | "add" | "remove";

export interface DiffLine {
  kind: DiffLineKind;
  content: string;
}

export interface DiffHunk {
  old_start: number;
  old_lines: number;
  new_start: number;
  new_lines: number;
  lines: DiffLine[];
}

export interface FileDiff {
  path: string;
  old_path: string | null;
  hunks: DiffHunk[];
  is_binary: boolean;
}

export type FilePreviewKind =
  | "text_diff"
  | "text_content"
  | "image"
  | "binary"
  | "deleted";

export interface FilePreview {
  path: string;
  kind: FilePreviewKind;
  mime: string;
  language: string | null;
  diff: FileDiff | null;
  content: string | null;
  data_base64: string | null;
  size_bytes: number;
  absolute_path: string | null;
}

export interface GraphLane {
  color_index: number;
  active: boolean;
  color?: string;
}

export interface GraphRow {
  lanes: GraphLane[];
  connector: string;
  marker: string;
}

export interface CommitEntry {
  hash: string;
  short_hash: string;
  parents: string[];
  author: string;
  email: string;
  date: number;
  subject: string;
  body: string;
  graph_row: GraphRow;
}

export interface BranchInfo {
  name: string;
  is_remote: boolean;
  is_current: boolean;
  upstream: string | null;
  last_commit: string | null;
  ahead: number;
  behind: number;
}

export interface RemoteOperationResult {
  success: boolean;
  output: string;
}

export interface StashEntry {
  index: number;
  message: string;
  branch: string;
}

export interface WorktreeEntry {
  path: string;
  branch: string | null;
  head: string;
  is_bare: boolean;
}

export interface RepoOperationState {
  merging: boolean;
  merge_head: string | null;
  rebasing: boolean;
  cherry_picking: boolean;
  reverting: boolean;
  conflict_count: number;
}

export interface GitHubAccount {
  username: string;
  token: string;
}

export interface GitLabAccount {
  username: string;
  token: string;
  host: string;
}

export interface PullRequestEntry {
  number: number;
  title: string;
  state: string;
  author: string;
  url: string;
  head: string;
  base: string;
}

export interface MergeRequestEntry {
  iid: number;
  title: string;
  state: string;
  author: string;
  url: string;
  source_branch: string;
  target_branch: string;
}

export interface CommitOptions {
  subject: string;
  body: string;
  amend: boolean;
  signoff: boolean;
}

export interface AppSettings {
  git_path: string;
  auto_fetch_minutes: number;
  recent_repos: string[];
  default_remote: string;
  shell_path: string;
  diff_mode: "unified" | "split";
  github_account: GitHubAccount | null;
  gitlab_account: GitLabAccount | null;
  store_settings_in_project: boolean;
  confirm_discard: boolean;
  ui_theme: UiTheme;
  ui_language: UiLanguage;
}

export type UiTheme = "dark" | "light";
export type UiLanguage = "en" | "zh";

export type CommitTwTab =
  | "local"
  | "staging"
  | "stash"
  | "conflicts"
  | "worktrees";

export type LeftToolWindow =
  | "project"
  | "git"
  | "pullRequests"
  | "mergeRequests";

export interface ProjectEntry {
  name: string;
  path: string;
  is_dir: boolean;
  git_ignored: boolean;
}

export interface ProjectTreeRow extends ProjectEntry {
  depth: number;
}

export interface AppProcessStats {
  memory_bytes: number;
  cpu_percent: number;
}

export type ProjectClipboardMode = "cut" | "copy";

export interface ProjectClipboard {
  mode: ProjectClipboardMode;
  path: string;
  is_dir: boolean;
}

export type BottomToolWindow = "terminal" | "vcsConsole" | null;

export interface ProjectFileText {
  content: string;
  is_binary: boolean;
  too_large: boolean;
  size_bytes: number;
}

export type EditorTabKind =
  | "diff"
  | "log"
  | "settings"
  | "welcome"
  | "branches"
  | "file";

export interface DiffTab {
  id: string;
  path: string;
  mode: "working" | "staged" | "commit" | "branch" | "branch_working";
  commitHash?: string;
  baseBranch?: string;
  headBranch?: string;
}

export interface EditorTab {
  id: string;
  kind: EditorTabKind;
  title: string;
  diff?: DiffTab;
  filePath?: string;
  pinned?: boolean;
}
