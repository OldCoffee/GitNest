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
  getRepoInfo: (repoPath?: string | null) =>
    invoke<RepoInfo>("get_repo_info", { repoPath: repoPath ?? null }),
  closeRepository: () => invoke<void>("close_repository"),
  openNewWindow: () => invoke<void>("open_new_window"),
  listWorkspaceRoots: () => invoke<string[]>("list_workspace_roots"),
  addWorkspaceFolder: (path: string) =>
    invoke<string[]>("add_workspace_folder", { path }),
  removeWorkspaceFolder: (path: string) =>
    invoke<string[]>("remove_workspace_folder", { path }),
  activateGitRoot: (path: string) =>
    invoke<RepoInfo>("activate_git_root", { path }),
  projectHasJavaMarkers: () => invoke<boolean>("project_has_java_markers"),
  getStatus: (repoPath?: string | null) =>
    invoke<StatusSnapshot>("get_status", { repoPath: repoPath ?? null }),
  stageFiles: (paths: string[], repoPath?: string | null) =>
    invoke<void>("stage_files", { paths, repoPath: repoPath ?? null }),
  unstageFiles: (paths: string[], repoPath?: string | null) =>
    invoke<void>("unstage_files", { paths, repoPath: repoPath ?? null }),
  stageAllFiles: (repoPath?: string | null) =>
    invoke<void>("stage_all_files", { repoPath: repoPath ?? null }),
  unstageAllFiles: (repoPath?: string | null) =>
    invoke<void>("unstage_all_files", { repoPath: repoPath ?? null }),
  stageHunk: (path: string, hunk: DiffHunk, repoPath?: string | null) =>
    invoke<void>("stage_hunk", { path, hunk, repoPath: repoPath ?? null }),
  unstageHunk: (path: string, hunk: DiffHunk, repoPath?: string | null) =>
    invoke<void>("unstage_hunk", { path, hunk, repoPath: repoPath ?? null }),
  stageLines: (
    path: string,
    hunk: DiffHunk,
    selectedIndices: number[],
    repoPath?: string | null,
  ) =>
    invoke<void>("stage_lines", {
      path,
      hunk,
      selectedIndices,
      repoPath: repoPath ?? null,
    }),
  unstageLines: (
    path: string,
    hunk: DiffHunk,
    selectedIndices: number[],
    repoPath?: string | null,
  ) =>
    invoke<void>("unstage_lines", {
      path,
      hunk,
      selectedIndices,
      repoPath: repoPath ?? null,
    }),
  discardHunk: (path: string, hunk: DiffHunk, repoPath?: string | null) =>
    invoke<void>("discard_hunk", { path, hunk, repoPath: repoPath ?? null }),
  discardLines: (
    path: string,
    hunk: DiffHunk,
    selectedIndices: number[],
    repoPath?: string | null,
  ) =>
    invoke<void>("discard_lines", {
      path,
      hunk,
      selectedIndices,
      repoPath: repoPath ?? null,
    }),
  getCommitTemplate: (repoPath?: string | null) =>
    invoke<string | null>("get_commit_template", { repoPath: repoPath ?? null }),
  commitChanges: (options: CommitOptions, repoPath?: string | null) =>
    invoke<CommitResult>("commit_changes", {
      options,
      repoPath: repoPath ?? null,
    }),
  discardChanges: (paths: string[], repoPath?: string | null) =>
    invoke<void>("discard_changes", { paths, repoPath: repoPath ?? null }),
  resolveConflictOurs: (path: string, repoPath?: string | null) =>
    invoke<void>("resolve_conflict_ours", { path, repoPath: repoPath ?? null }),
  resolveConflictTheirs: (path: string, repoPath?: string | null) =>
    invoke<void>("resolve_conflict_theirs", {
      path,
      repoPath: repoPath ?? null,
    }),
  getDiffWorking: (path: string, repoPath?: string | null) =>
    invoke<FileDiff>("get_diff_working", { path, repoPath: repoPath ?? null }),
  getDiffStaged: (path: string, repoPath?: string | null) =>
    invoke<FileDiff>("get_diff_staged", { path, repoPath: repoPath ?? null }),
  getDiffCommits: (
    base: string,
    head: string,
    path?: string,
    repoPath?: string | null,
  ) =>
    invoke<FileDiff>("get_diff_commits", {
      base,
      head,
      path: path ?? null,
      repoPath: repoPath ?? null,
    }),
  getCommitChangedFiles: (commit: string, repoPath?: string | null) =>
    invoke<string[]>("get_commit_changed_files", {
      commit,
      repoPath: repoPath ?? null,
    }),
  getFilePreview: (
    path: string,
    mode: "working" | "staged" | "commit",
    commitHash?: string | null,
    repoPath?: string | null,
  ) =>
    invoke<FilePreview>("get_file_preview", {
      path,
      mode,
      commitHash: commitHash ?? null,
      repoPath: repoPath ?? null,
    }),
  getLog: (
    branch: string | null,
    skip: number,
    limit: number,
    filters?: { author?: string | null; since?: string | null; path?: string | null },
    repoPath?: string | null,
  ) =>
    invoke<CommitEntry[]>("get_log", {
      branch,
      skip,
      limit,
      author: filters?.author ?? null,
      since: filters?.since ?? null,
      path: filters?.path ?? null,
      repoPath: repoPath ?? null,
    }),
  getLogCount: (
    branch: string | null,
    filters?: { author?: string | null; since?: string | null; path?: string | null },
    repoPath?: string | null,
  ) =>
    invoke<number>("get_log_count", {
      branch,
      author: filters?.author ?? null,
      since: filters?.since ?? null,
      path: filters?.path ?? null,
      repoPath: repoPath ?? null,
    }),
  getLogAuthors: (branch: string | null, repoPath?: string | null) =>
    invoke<string[]>("get_log_authors", { branch, repoPath: repoPath ?? null }),
  getBranchesContaining: (hash: string, repoPath?: string | null) =>
    invoke<string[]>("get_branches_containing", {
      hash,
      repoPath: repoPath ?? null,
    }),
  getBranches: (repoPath?: string | null) =>
    invoke<BranchInfo[]>("get_branches", { repoPath: repoPath ?? null }),
  checkoutBranch: (name: string, repoPath?: string | null) =>
    invoke<void>("checkout_branch", { name, repoPath: repoPath ?? null }),
  createNewBranch: (name: string, repoPath?: string | null) =>
    invoke<void>("create_new_branch", { name, repoPath: repoPath ?? null }),
  createBranchFrom: (
    name: string,
    startPoint: string,
    repoPath?: string | null,
  ) =>
    invoke<void>("create_branch_from", {
      name,
      startPoint,
      repoPath: repoPath ?? null,
    }),
  renameBranch: (
    oldName: string,
    newName: string,
    repoPath?: string | null,
  ) =>
    invoke<void>("rename_branch", {
      oldName,
      newName,
      repoPath: repoPath ?? null,
    }),
  checkoutAndRebaseOnto: (
    branch: string,
    onto: string,
    repoPath?: string | null,
  ) =>
    invoke<void>("checkout_and_rebase_onto", {
      branch,
      onto,
      repoPath: repoPath ?? null,
    }),
  rebaseCurrentOnto: (
    baseBranch: string,
    ontoBranch: string,
    repoPath?: string | null,
  ) =>
    invoke<void>("rebase_current_onto", {
      baseBranch,
      ontoBranch,
      repoPath: repoPath ?? null,
    }),
  mergeBranchInto: (
    intoBranch: string,
    fromBranch: string,
    repoPath?: string | null,
  ) =>
    invoke<void>("merge_branch_into_current", {
      intoBranch,
      fromBranch,
      repoPath: repoPath ?? null,
    }),
  updateLocalBranch: (branch: string, repoPath?: string | null) =>
    invoke<string>("update_local_branch", {
      branch,
      repoPath: repoPath ?? null,
    }),
  pullRemoteIntoBranch: (
    intoBranch: string,
    remoteBranch: string,
    useRebase: boolean,
    repoPath?: string | null,
  ) =>
    invoke<string>("pull_remote_into_branch", {
      intoBranch,
      remoteBranch,
      useRebase,
      repoPath: repoPath ?? null,
    }),
  deleteExistingBranch: (
    name: string,
    force: boolean,
    repoPath?: string | null,
  ) =>
    invoke<void>("delete_existing_branch", {
      name,
      force,
      repoPath: repoPath ?? null,
    }),
  deleteRemoteBranch: (remoteBranch: string, repoPath?: string | null) =>
    invoke<void>("delete_remote_branch_ref", {
      remoteBranch,
      repoPath: repoPath ?? null,
    }),
  getBranchDiffFiles: (
    base: string,
    head: string,
    repoPath?: string | null,
  ) =>
    invoke<string[]>("get_branch_diff_files", {
      base,
      head,
      repoPath: repoPath ?? null,
    }),
  getDiffBranchRange: (
    base: string,
    head: string,
    path: string,
    repoPath?: string | null,
  ) =>
    invoke<FileDiff>("get_diff_branch_range", {
      base,
      head,
      path,
      repoPath: repoPath ?? null,
    }),
  getDiffBranchWorking: (
    branch: string,
    path: string,
    repoPath?: string | null,
  ) =>
    invoke<FileDiff>("get_diff_branch_working", {
      branch,
      path,
      repoPath: repoPath ?? null,
    }),
  getBranchWorkingDiffFiles: (branch: string, repoPath?: string | null) =>
    invoke<string[]>("get_branch_working_diff_files", {
      branch,
      repoPath: repoPath ?? null,
    }),
  getRemotes: (repoPath?: string | null) =>
    invoke<RemoteInfo[]>("get_remotes", { repoPath: repoPath ?? null }),
  gitFetch: (remote: string, repoPath?: string | null) =>
    invoke<RemoteOperationResult>("git_fetch", {
      remote,
      repoPath: repoPath ?? null,
    }),
  gitPull: (remote: string, branch: string, repoPath?: string | null) =>
    invoke<RemoteOperationResult>("git_pull", {
      remote,
      branch,
      repoPath: repoPath ?? null,
    }),
  gitPush: (remote: string, branch: string, repoPath?: string | null) =>
    invoke<RemoteOperationResult>("git_push", {
      remote,
      branch,
      repoPath: repoPath ?? null,
    }),
  getSettings: () => invoke<AppSettings>("get_settings"),
  saveSettings: (settings: AppSettings) =>
    invoke<void>("save_settings", { settings }),
  getRecentRepos: () => invoke<string[]>("get_recent_repos"),
  clearRecentRepos: () => invoke<void>("clear_recent_repos"),
  getRepoOperationState: (repoPath?: string | null) =>
    invoke<RepoOperationState>("get_repo_operation_state", {
      repoPath: repoPath ?? null,
    }),
  gitMerge: (branch: string, repoPath?: string | null) =>
    invoke<RemoteOperationResult>("git_merge", {
      branch,
      repoPath: repoPath ?? null,
    }),
  gitMergeAbort: (repoPath?: string | null) =>
    invoke<RemoteOperationResult>("git_merge_abort", {
      repoPath: repoPath ?? null,
    }),
  gitRebase: (branch: string, repoPath?: string | null) =>
    invoke<RemoteOperationResult>("git_rebase", {
      branch,
      repoPath: repoPath ?? null,
    }),
  gitRebaseContinue: (repoPath?: string | null) =>
    invoke<RemoteOperationResult>("git_rebase_continue", {
      repoPath: repoPath ?? null,
    }),
  gitRebaseSkip: (repoPath?: string | null) =>
    invoke<RemoteOperationResult>("git_rebase_skip", {
      repoPath: repoPath ?? null,
    }),
  gitRebaseAbort: (repoPath?: string | null) =>
    invoke<RemoteOperationResult>("git_rebase_abort", {
      repoPath: repoPath ?? null,
    }),
  gitReset: (mode: string, target: string, repoPath?: string | null) =>
    invoke<RemoteOperationResult>("git_reset", {
      mode,
      target,
      repoPath: repoPath ?? null,
    }),
  gitRevert: (commit: string, repoPath?: string | null) =>
    invoke<RemoteOperationResult>("git_revert", {
      commit,
      repoPath: repoPath ?? null,
    }),
  gitCherryPick: (commit: string, repoPath?: string | null) =>
    invoke<RemoteOperationResult>("git_cherry_pick", {
      commit,
      repoPath: repoPath ?? null,
    }),
  gitCherryPickAbort: (repoPath?: string | null) =>
    invoke<RemoteOperationResult>("git_cherry_pick_abort", {
      repoPath: repoPath ?? null,
    }),
  listStashes: (repoPath?: string | null) =>
    invoke<StashEntry[]>("list_stashes", { repoPath: repoPath ?? null }),
  stashPush: (message: string | null, repoPath?: string | null) =>
    invoke<void>("stash_push", { message, repoPath: repoPath ?? null }),
  stashPop: (index: number, repoPath?: string | null) =>
    invoke<void>("stash_pop", { index, repoPath: repoPath ?? null }),
  stashApply: (index: number, repoPath?: string | null) =>
    invoke<void>("stash_apply", { index, repoPath: repoPath ?? null }),
  stashDrop: (index: number, repoPath?: string | null) =>
    invoke<void>("stash_drop", { index, repoPath: repoPath ?? null }),
  listWorktrees: (repoPath?: string | null) =>
    invoke<WorktreeEntry[]>("list_worktrees", { repoPath: repoPath ?? null }),
  addWorktree: (
    path: string,
    branch: string | null,
    repoPath?: string | null,
  ) =>
    invoke<void>("add_worktree", {
      path,
      branch,
      repoPath: repoPath ?? null,
    }),
  removeWorktree: (
    path: string,
    force: boolean,
    repoPath?: string | null,
  ) =>
    invoke<void>("remove_worktree", {
      path,
      force,
      repoPath: repoPath ?? null,
    }),
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
  gitAddRemote: (name: string, url: string, repoPath?: string | null) =>
    invoke<void>("git_add_remote", { name, url, repoPath: repoPath ?? null }),
  gitRemoveRemote: (name: string, repoPath?: string | null) =>
    invoke<void>("git_remove_remote", { name, repoPath: repoPath ?? null }),
  gitSetRemoteUrl: (name: string, url: string, repoPath?: string | null) =>
    invoke<void>("git_set_remote_url", {
      name,
      url,
      repoPath: repoPath ?? null,
    }),
  gitCreateTag: (
    name: string,
    message: string | null,
    repoPath?: string | null,
  ) =>
    invoke<void>("git_create_tag", {
      name,
      message,
      repoPath: repoPath ?? null,
    }),
  gitDeleteTag: (name: string, repoPath?: string | null) =>
    invoke<void>("git_delete_tag", { name, repoPath: repoPath ?? null }),
  terminalRun: (command: string) =>
    invoke<string>("terminal_run", { command }),
  terminalCreate: (options?: {
    cols?: number;
    rows?: number;
    cwd?: string | null;
  }) =>
    invoke<number>("terminal_create", {
      cols: options?.cols ?? 100,
      rows: options?.rows ?? 30,
      cwd: options?.cwd ?? null,
    }),
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
