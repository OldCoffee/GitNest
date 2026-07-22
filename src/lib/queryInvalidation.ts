import type { QueryClient, QueryKey } from "@tanstack/react-query";
import { sameWorkspacePath } from "./workspaceRoots";

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

export type WorkspaceEventInvalidation = {
  gitChanged: boolean;
  workspaceChanged: boolean;
  /** When set, invalidate only this git root's partitioned queries. */
  rootPath?: string | null;
};

function invalidateRootKeyed(
  queryClient: QueryClient,
  head: string,
  rootPath: string | null,
): Promise<unknown> {
  if (!rootPath) {
    return queryClient.invalidateQueries({ queryKey: [head] });
  }
  return queryClient.invalidateQueries({
    predicate: (query) => {
      const key = query.queryKey as QueryKey;
      if (key[0] !== head) return false;
      const path = key[1];
      return typeof path === "string" && sameWorkspacePath(path, rootPath);
    },
  });
}

/** Narrow refresh used by workspace file watcher events. */
export function invalidateFromWorkspaceEvent(
  queryClient: QueryClient,
  payload: WorkspaceEventInvalidation,
): Promise<void> {
  const root = payload.rootPath?.trim() || null;
  const tasks: Array<Promise<unknown>> = [];

  if (payload.gitChanged || payload.workspaceChanged) {
    tasks.push(invalidateRootKeyed(queryClient, "status", root));
  }
  if (payload.gitChanged) {
    tasks.push(invalidateRootKeyed(queryClient, "repo-info", root));
    tasks.push(invalidateRootKeyed(queryClient, "branches", root));
    tasks.push(invalidateRootKeyed(queryClient, "repo-operation-state", root));
  }
  if (payload.workspaceChanged) {
    tasks.push(invalidateRootKeyed(queryClient, "project-entries", root));
    tasks.push(queryClient.invalidateQueries({ queryKey: ["project-tree"] }));
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
