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
  additions?: number | null;
  deletions?: number | null;
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
  old_lineno?: number | null;
  new_lineno?: number | null;
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

export interface GraphEdge {
  from_lane: number;
  /** Vertical anchor: 0 = top of row, 1 = node center, 2 = bottom of row. */
  from_y: 0 | 1 | 2;
  to_lane: number;
  to_y: 0 | 1 | 2;
  color: string;
}

export interface GraphRow {
  node_lane: number;
  node_color: string;
  is_merge: boolean;
  width: number;
  edges: GraphEdge[];
}

export interface CommitRef {
  name: string;
  kind: "head" | "local" | "remote" | "tag";
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
  refs: CommitRef[];
  graph_row: GraphRow;
}

export interface LogFilters {
  author?: string | null;
  since?: string | null;
  path?: string | null;
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

export interface CommitOptions {
  subject: string;
  body: string;
  amend: boolean;
  signoff: boolean;
}

export interface AppSettings {
  schema_version: number;
  git_path: string;
  auto_fetch_minutes: number;
  recent_repos: string[];
  default_remote: string;
  shell_path: string;
  diff_mode: "unified" | "split";
  store_settings_in_project: boolean;
  confirm_discard: boolean;
  ui_theme: UiTheme;
  ui_language: UiLanguage;
  java_home: string;
  jdt_ls_path: string;
  maven_home: string;
}

export type UiTheme = "dark" | "light";
export type UiLanguage = "en" | "zh";

export type CommitTwTab =
  | "local"
  | "staging"
  | "stash"
  | "conflicts"
  | "worktrees";

export type LeftToolWindow = "project" | "git" | "search";

export interface SearchMatch {
  path: string;
  line: number;
  column: number;
  preview: string;
}

export interface SearchBatch {
  taskId: number;
  matches: SearchMatch[];
  done: boolean;
  total: number;
  error: string | null;
}

export interface TaskInfo {
  id: number;
  label: string;
  state: "running" | "completed" | "failed" | "canceled";
  started_ms: number;
  finished_ms: number | null;
  error: string | null;
}

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
  modified_ms: number;
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
