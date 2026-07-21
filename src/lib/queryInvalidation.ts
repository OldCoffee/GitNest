import type { QueryClient } from "@tanstack/react-query";

/** Core Git working-tree / branch / operation queries. */
export function invalidateGitState(queryClient: QueryClient): Promise<void> {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ["status"] }),
    queryClient.invalidateQueries({ queryKey: ["repo-info"] }),
    queryClient.invalidateQueries({ queryKey: ["branches"] }),
    queryClient.invalidateQueries({ queryKey: ["repo-operation-state"] }),
  ]).then(() => undefined);
}

/** Project tree / directory listing. */
export function invalidateProject(queryClient: QueryClient): Promise<void> {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ["project-entries"] }),
    queryClient.invalidateQueries({ queryKey: ["project-tree"] }),
  ]).then(() => undefined);
}

/** After a mutating Git command that also advances history. */
export function invalidateAfterGitMutation(
  queryClient: QueryClient,
  options?: { includeLog?: boolean; includeStashes?: boolean; includeWorktrees?: boolean },
): Promise<void> {
  const tasks: Array<Promise<unknown>> = [
    invalidateGitState(queryClient),
  ];
  if (options?.includeLog !== false) {
    tasks.push(queryClient.invalidateQueries({ queryKey: ["log"] }));
  }
  if (options?.includeStashes) {
    tasks.push(queryClient.invalidateQueries({ queryKey: ["stashes"] }));
  }
  if (options?.includeWorktrees) {
    tasks.push(queryClient.invalidateQueries({ queryKey: ["worktrees"] }));
  }
  return Promise.all(tasks).then(() => undefined);
}

/** Narrow refresh used by workspace file watcher events. */
export function invalidateFromWorkspaceEvent(
  queryClient: QueryClient,
  payload: { gitChanged: boolean; workspaceChanged: boolean },
): Promise<void> {
  const tasks: Array<Promise<unknown>> = [];
  if (payload.gitChanged || payload.workspaceChanged) {
    tasks.push(queryClient.invalidateQueries({ queryKey: ["status"] }));
  }
  if (payload.gitChanged) {
    tasks.push(queryClient.invalidateQueries({ queryKey: ["repo-info"] }));
    tasks.push(queryClient.invalidateQueries({ queryKey: ["branches"] }));
    tasks.push(queryClient.invalidateQueries({ queryKey: ["repo-operation-state"] }));
  }
  if (payload.workspaceChanged) {
    tasks.push(invalidateProject(queryClient));
  }
  return Promise.all(tasks).then(() => undefined);
}

export function invalidateStatus(queryClient: QueryClient): Promise<void> {
  return queryClient.invalidateQueries({ queryKey: ["status"] }).then(() => undefined);
}

export function invalidateLog(queryClient: QueryClient): Promise<void> {
  return queryClient.invalidateQueries({ queryKey: ["log"] }).then(() => undefined);
}

export function invalidatePreview(queryClient: QueryClient): Promise<void> {
  return queryClient.invalidateQueries({ queryKey: ["preview"] }).then(() => undefined);
}

export function invalidateSettings(queryClient: QueryClient): Promise<void> {
  return queryClient.invalidateQueries({ queryKey: ["settings"] }).then(() => undefined);
}

/** Keys touched by {@link invalidateGitState} — for tests. */
export const GIT_STATE_KEYS = [
  ["status"],
  ["repo-info"],
  ["branches"],
  ["repo-operation-state"],
] as const;

/** Keys touched by {@link invalidateProject} — for tests. */
export const PROJECT_KEYS = [["project-entries"], ["project-tree"]] as const;
