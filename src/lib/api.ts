import { invoke } from "@tauri-apps/api/core";
import type {
  AppSettings,
  AppProcessStats,
  BranchInfo,
  CommitEntry,
  CommitOptions,
  CommitResult,
  CreateMergeRequestOptions,
  CreatePullRequestOptions,
  DiffHunk,
  FileDiff,
  FilePreview,
  GitHubAccount,
  GitLabAccount,
  MergeRequestEntry,
  PullRequestEntry,
  RemoteInfo,
  RemoteOperationResult,
  RepoInfo,
  RepoOperationState,
  StashEntry,
  StatusSnapshot,
  WorktreeEntry,
  ProjectEntry,
  ProjectTreeRow,
  ProjectFileText,
  TaskInfo,
} from "./types";

export const api = {
  openRepository: (path: string) =>
    invoke<RepoInfo>("open_repository", { path }),
  isGitRepository: (path: string) =>
    invoke<boolean>("is_git_repository", { path }),
  initGitRepository: (path: string) =>
    invoke<void>("init_git_repository", { path }),
  getRepoInfo: () => invoke<RepoInfo>("get_repo_info"),
  closeRepository: () => invoke<void>("close_repository"),
  openNewWindow: () => invoke<void>("open_new_window"),
  listWorkspaceRoots: () => invoke<string[]>("list_workspace_roots"),
  addWorkspaceFolder: (path: string) =>
    invoke<string[]>("add_workspace_folder", { path }),
  removeWorkspaceFolder: (path: string) =>
    invoke<string[]>("remove_workspace_folder", { path }),
  projectHasJavaMarkers: () => invoke<boolean>("project_has_java_markers"),
  getStatus: () => invoke<StatusSnapshot>("get_status"),
  stageFiles: (paths: string[]) =>
    invoke<void>("stage_files", { paths }),
  unstageFiles: (paths: string[]) =>
    invoke<void>("unstage_files", { paths }),
  stageAllFiles: () => invoke<void>("stage_all_files"),
  unstageAllFiles: () => invoke<void>("unstage_all_files"),
  stageHunk: (path: string, hunk: DiffHunk) =>
    invoke<void>("stage_hunk", { path, hunk }),
  unstageHunk: (path: string, hunk: DiffHunk) =>
    invoke<void>("unstage_hunk", { path, hunk }),
  stageLines: (path: string, hunk: DiffHunk, selectedIndices: number[]) =>
    invoke<void>("stage_lines", {
      path,
      hunk,
      selectedIndices,
    }),
  unstageLines: (path: string, hunk: DiffHunk, selectedIndices: number[]) =>
    invoke<void>("unstage_lines", {
      path,
      hunk,
      selectedIndices,
    }),
  discardHunk: (path: string, hunk: DiffHunk) =>
    invoke<void>("discard_hunk", { path, hunk }),
  discardLines: (path: string, hunk: DiffHunk, selectedIndices: number[]) =>
    invoke<void>("discard_lines", {
      path,
      hunk,
      selectedIndices,
    }),
  getCommitTemplate: () => invoke<string | null>("get_commit_template"),
  commitChanges: (options: CommitOptions) =>
    invoke<CommitResult>("commit_changes", { options }),
  discardChanges: (paths: string[]) =>
    invoke<void>("discard_changes", { paths }),
  resolveConflictOurs: (path: string) =>
    invoke<void>("resolve_conflict_ours", { path }),
  resolveConflictTheirs: (path: string) =>
    invoke<void>("resolve_conflict_theirs", { path }),
  getDiffWorking: (path: string) =>
    invoke<FileDiff>("get_diff_working", { path }),
  getDiffStaged: (path: string) =>
    invoke<FileDiff>("get_diff_staged", { path }),
  getDiffCommits: (base: string, head: string, path?: string) =>
    invoke<FileDiff>("get_diff_commits", { base, head, path: path ?? null }),
  getCommitChangedFiles: (commit: string) =>
    invoke<string[]>("get_commit_changed_files", { commit }),
  getFilePreview: (
    path: string,
    mode: "working" | "staged" | "commit",
    commitHash?: string | null,
  ) =>
    invoke<FilePreview>("get_file_preview", {
      path,
      mode,
      commitHash: commitHash ?? null,
    }),
  getLog: (
    branch: string | null,
    skip: number,
    limit: number,
    filters?: { author?: string | null; since?: string | null; path?: string | null },
  ) =>
    invoke<CommitEntry[]>("get_log", {
      branch,
      skip,
      limit,
      author: filters?.author ?? null,
      since: filters?.since ?? null,
      path: filters?.path ?? null,
    }),
  getLogCount: (
    branch: string | null,
    filters?: { author?: string | null; since?: string | null; path?: string | null },
  ) =>
    invoke<number>("get_log_count", {
      branch,
      author: filters?.author ?? null,
      since: filters?.since ?? null,
      path: filters?.path ?? null,
    }),
  getLogAuthors: (branch: string | null) =>
    invoke<string[]>("get_log_authors", { branch }),
  getBranchesContaining: (hash: string) =>
    invoke<string[]>("get_branches_containing", { hash }),
  getBranches: () => invoke<BranchInfo[]>("get_branches"),
  checkoutBranch: (name: string) =>
    invoke<void>("checkout_branch", { name }),
  createNewBranch: (name: string) =>
    invoke<void>("create_new_branch", { name }),
  createBranchFrom: (name: string, startPoint: string) =>
    invoke<void>("create_branch_from", { name, startPoint }),
  renameBranch: (oldName: string, newName: string) =>
    invoke<void>("rename_branch", { oldName, newName }),
  checkoutAndRebaseOnto: (branch: string, onto: string) =>
    invoke<void>("checkout_and_rebase_onto", { branch, onto }),
  rebaseCurrentOnto: (baseBranch: string, ontoBranch: string) =>
    invoke<void>("rebase_current_onto", { baseBranch, ontoBranch }),
  mergeBranchInto: (intoBranch: string, fromBranch: string) =>
    invoke<void>("merge_branch_into_current", { intoBranch, fromBranch }),
  updateLocalBranch: (branch: string) =>
    invoke<string>("update_local_branch", { branch }),
  pullRemoteIntoBranch: (
    intoBranch: string,
    remoteBranch: string,
    useRebase: boolean,
  ) =>
    invoke<string>("pull_remote_into_branch", {
      intoBranch,
      remoteBranch,
      useRebase,
    }),
  deleteExistingBranch: (name: string, force: boolean) =>
    invoke<void>("delete_existing_branch", { name, force }),
  deleteRemoteBranch: (remoteBranch: string) =>
    invoke<void>("delete_remote_branch_ref", { remoteBranch }),
  getBranchDiffFiles: (base: string, head: string) =>
    invoke<string[]>("get_branch_diff_files", { base, head }),
  getDiffBranchRange: (base: string, head: string, path: string) =>
    invoke<FileDiff>("get_diff_branch_range", { base, head, path }),
  getDiffBranchWorking: (branch: string, path: string) =>
    invoke<FileDiff>("get_diff_branch_working", { branch, path }),
  getBranchWorkingDiffFiles: (branch: string) =>
    invoke<string[]>("get_branch_working_diff_files", { branch }),
  getRemotes: () => invoke<RemoteInfo[]>("get_remotes"),
  gitFetch: (remote: string) =>
    invoke<RemoteOperationResult>("git_fetch", { remote }),
  gitPull: (remote: string, branch: string) =>
    invoke<RemoteOperationResult>("git_pull", { remote, branch }),
  gitPush: (remote: string, branch: string) =>
    invoke<RemoteOperationResult>("git_push", { remote, branch }),
  getSettings: () => invoke<AppSettings>("get_settings"),
  saveSettings: (settings: AppSettings) =>
    invoke<void>("save_settings", { settings }),
  getRecentRepos: () => invoke<string[]>("get_recent_repos"),
  clearRecentRepos: () => invoke<void>("clear_recent_repos"),
  getRepoOperationState: () =>
    invoke<RepoOperationState>("get_repo_operation_state"),
  gitMerge: (branch: string) =>
    invoke<RemoteOperationResult>("git_merge", { branch }),
  gitMergeAbort: () => invoke<RemoteOperationResult>("git_merge_abort"),
  gitRebase: (branch: string) =>
    invoke<RemoteOperationResult>("git_rebase", { branch }),
  gitRebaseContinue: () =>
    invoke<RemoteOperationResult>("git_rebase_continue"),
  gitRebaseSkip: () => invoke<RemoteOperationResult>("git_rebase_skip"),
  gitRebaseAbort: () => invoke<RemoteOperationResult>("git_rebase_abort"),
  gitReset: (mode: string, target: string) =>
    invoke<RemoteOperationResult>("git_reset", { mode, target }),
  gitRevert: (commit: string) =>
    invoke<RemoteOperationResult>("git_revert", { commit }),
  gitCherryPick: (commit: string) =>
    invoke<RemoteOperationResult>("git_cherry_pick", { commit }),
  gitCherryPickAbort: () =>
    invoke<RemoteOperationResult>("git_cherry_pick_abort"),
  listStashes: () => invoke<StashEntry[]>("list_stashes"),
  stashPush: (message: string | null) =>
    invoke<void>("stash_push", { message }),
  stashPop: (index: number) => invoke<void>("stash_pop", { index }),
  stashApply: (index: number) => invoke<void>("stash_apply", { index }),
  stashDrop: (index: number) => invoke<void>("stash_drop", { index }),
  listWorktrees: () => invoke<WorktreeEntry[]>("list_worktrees"),
  addWorktree: (path: string, branch: string | null) =>
    invoke<void>("add_worktree", { path, branch }),
  removeWorktree: (path: string, force: boolean) =>
    invoke<void>("remove_worktree", { path, force }),
  githubVerify: (account: GitHubAccount) =>
    invoke<string>("github_verify", { account }),
  githubListPrs: (account: GitHubAccount, repo: string) =>
    invoke<PullRequestEntry[]>("github_list_prs", { account, repo }),
  githubCreatePr: (
    account: GitHubAccount,
    repo: string,
    options: CreatePullRequestOptions,
  ) => invoke<PullRequestEntry>("github_create_pr", { account, repo, options }),
  gitlabVerify: (account: GitLabAccount) =>
    invoke<string>("gitlab_verify", { account }),
  gitlabListMrs: (account: GitLabAccount, project: string) =>
    invoke<MergeRequestEntry[]>("gitlab_list_mrs", { account, project }),
  gitlabCreateMr: (
    account: GitLabAccount,
    project: string,
    options: CreateMergeRequestOptions,
  ) =>
    invoke<MergeRequestEntry>("gitlab_create_mr", {
      account,
      project,
      options,
    }),
  gitClone: (url: string, path: string, cloneId: string) =>
    invoke<RemoteOperationResult>("git_clone", { url, path, cloneId }),
  cancelClone: (cloneId: string) =>
    invoke<void>("cancel_clone", { cloneId }),
  gitAddRemote: (name: string, url: string) =>
    invoke<void>("git_add_remote", { name, url }),
  gitRemoveRemote: (name: string) =>
    invoke<void>("git_remove_remote", { name }),
  gitSetRemoteUrl: (name: string, url: string) =>
    invoke<void>("git_set_remote_url", { name, url }),
  gitCreateTag: (name: string, message: string | null) =>
    invoke<void>("git_create_tag", { name, message }),
  gitDeleteTag: (name: string) =>
    invoke<void>("git_delete_tag", { name }),
  terminalRun: (command: string) =>
    invoke<string>("terminal_run", { command }),
  terminalCreate: (cols = 100, rows = 30) =>
    invoke<number>("terminal_create", { cols, rows }),
  terminalWrite: (sessionId: number, data: number[]) =>
    invoke<void>("terminal_write", { sessionId, data }),
  terminalResize: (sessionId: number, cols: number, rows: number) =>
    invoke<void>("terminal_resize", { sessionId, cols, rows }),
  terminalClose: (sessionId: number) =>
    invoke<void>("terminal_close", { sessionId }),
  terminalCloseAll: () => invoke<number>("terminal_close_all"),
  listProjectEntries: (relativePath?: string | null, root?: string | null) =>
    invoke<ProjectEntry[]>("list_project_entries", {
      relativePath: relativePath ?? null,
      root: root ?? null,
    }),
  listProjectTree: () => invoke<ProjectTreeRow[]>("list_project_tree"),
  createProjectFile: (parentPath: string | null, name: string, root?: string | null) =>
    invoke<string>("create_project_file", { parentPath, name, root: root ?? null }),
  createProjectDirectory: (parentPath: string | null, name: string, root?: string | null) =>
    invoke<string>("create_project_directory", {
      parentPath,
      name,
      root: root ?? null,
    }),
  renameProjectEntry: (path: string, newName: string, root?: string | null) =>
    invoke<string>("rename_project_entry", { path, newName, root: root ?? null }),
  moveProjectEntry: (
    sourcePath: string,
    destDirPath: string | null,
    root?: string | null,
  ) =>
    invoke<string>("move_project_entry", {
      sourcePath,
      destDirPath,
      root: root ?? null,
    }),
  copyProjectEntry: (
    sourcePath: string,
    destDirPath: string | null,
    root?: string | null,
  ) =>
    invoke<string>("copy_project_entry", {
      sourcePath,
      destDirPath,
      root: root ?? null,
    }),
  deleteProjectEntry: (path: string, root?: string | null) =>
    invoke<void>("delete_project_entry", { path, root: root ?? null }),
  readTextFile: (path: string, root?: string | null) =>
    invoke<ProjectFileText>("read_text_file", { path, root: root ?? null }),
  readAbsoluteTextFile: (path: string) =>
    invoke<ProjectFileText>("read_absolute_text_file", { path }),
  writeTextFile: (
    path: string,
    content: string,
    expectedModifiedMs: number | null,
    force = false,
    root?: string | null,
  ) =>
    invoke<number>("write_text_file", {
      path,
      content,
      expectedModifiedMs,
      force,
      root: root ?? null,
    }),
  getProjectAbsolutePath: (path: string, root?: string | null) =>
    invoke<string>("get_project_absolute_path", { path, root: root ?? null }),
  startWorkspaceSearch: (
    query: string,
    options?: {
      fileNamesOnly?: boolean;
      caseSensitive?: boolean;
      useRegex?: boolean;
    },
  ) =>
    invoke<number>("start_workspace_search", {
      query,
      fileNamesOnly: options?.fileNamesOnly ?? false,
      caseSensitive: options?.caseSensitive ?? false,
      useRegex: options?.useRegex ?? false,
    }),
  listTasks: () => invoke<TaskInfo[]>("list_tasks"),
  cancelTask: (id: number) => invoke<boolean>("cancel_task", { id }),
  javaLspStatus: () =>
    invoke<{
      available: boolean;
      javaExecutable: string;
      javaHome: string;
      javaVersion: string | null;
      javaSource: string;
      mavenHome: string;
      mavenExecutable: string;
      mavenVersion: string | null;
      mavenSource: string;
      mavenGlobalSettings: string | null;
      mavenUserSettings: string | null;
      jdtLsPath: string;
      needsInstall: boolean;
      hasWorkspaceCache: boolean;
      error: string | null;
    }>("java_lsp_status"),
  detectJavaRuntime: () =>
    invoke<{
      home: string;
      executable: string;
      version: string | null;
      source: string;
    }>("detect_java_runtime"),
  detectMavenRuntime: () =>
    invoke<{
      home: string;
      executable: string;
      version: string | null;
      source: string;
      globalSettings: string | null;
      userSettings: string | null;
    }>("detect_maven_runtime"),
  detectJdtLs: () =>
    invoke<{
      path: string;
      source: string;
      valid: boolean;
      needsInstall: boolean;
    }>("detect_jdt_ls"),
  javaLspStart: () => invoke<number>("java_lsp_start"),
  decompileClassFile: (path: string) =>
    invoke<{ content: string; path: string; sizeBytes: number }>("decompile_class_file", {
      path,
    }),
  lspSend: (sessionId: number, message: unknown) =>
    invoke<void>("lsp_send", { sessionId, message }),
  lspStop: (sessionId: number) => invoke<void>("lsp_stop", { sessionId }),
  addToGitignore: (path: string) => invoke<void>("add_to_gitignore", { path }),
  importExternalEntries: (externalPaths: string[], destDirPath?: string | null) =>
    invoke<string[]>("import_external_entries", {
      externalPaths,
      destDirPath: destDirPath ?? null,
    }),
  getClipboardFilePaths: () => invoke<string[]>("get_clipboard_file_paths"),
  getAppProcessStats: () => invoke<AppProcessStats>("get_app_process_stats"),
  getPerfProbeConfig: () =>
    invoke<{
      repo_path: string;
      file_path: string | null;
      version: string;
    } | null>("get_perf_probe_config"),
  writePerfReport: (json: string) => invoke<string>("write_perf_report", { json }),
  getDesktopSmokeConfig: () =>
    invoke<{ repo_path: string; version: string } | null>("get_desktop_smoke_config"),
  writeSmokeReport: (json: string) => invoke<string>("write_smoke_report", { json }),
  exportDiagnostics: (path: string) => invoke<string>("export_diagnostics", { path }),
};
