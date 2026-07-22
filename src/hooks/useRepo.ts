import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listen } from "@tauri-apps/api/event";
import { useEffect, useMemo } from "react";
import { api } from "../lib/api";
import { documentStore } from "../editor/documentStore";
import { javaLspClient } from "../editor/lspClient";
import {
  invalidateFromWorkspaceEvent,
  invalidateGitState,
} from "../lib/queryInvalidation";
import { buildScmDecorationMap } from "../lib/scmDecorations";
import { useAppStore } from "../store/appStore";

interface WorkspaceChange {
  paths: string[];
  kind: "create" | "modify" | "remove";
  generation: number;
}

export function useRepoChangedListener() {
  const queryClient = useQueryClient();

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    listen<WorkspaceChange>("workspace-changed", ({ payload }) => {
      const gitChanged = payload.paths.some(
        (path) => path === ".git" || path.startsWith(".git/"),
      );
      const workspacePaths = payload.paths.filter(
        (path) => path !== ".git" && !path.startsWith(".git/"),
      );

      void invalidateFromWorkspaceEvent(queryClient, {
        gitChanged,
        workspaceChanged: workspacePaths.length > 0,
      });

      if (workspacePaths.length > 0) {
        for (const path of workspacePaths) {
          if (documentStore.has(path)) {
            void documentStore.applyDiskChange(path);
          }
        }
        // Incremental Java/Maven index update — no full rebuild.
        void javaLspClient.applyWorkspaceChanges(workspacePaths, payload.kind);
      }
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      unlisten?.();
    };
  }, [queryClient]);
}

/** Commit tool window target root (may differ from activeGitRoot). */
export function useCommitRepoPath(): string | null {
  return useAppStore((s) => s.commitRepoPath ?? s.activeGitRoot);
}

export function useStatus(enabled: boolean) {
  const commitRepoPath = useCommitRepoPath();
  return useQuery({
    queryKey: ["status", commitRepoPath],
    queryFn: () => api.getStatus(commitRepoPath),
    enabled: enabled && !!commitRepoPath,
    refetchInterval: false,
    staleTime: 5000,
    structuralSharing: true,
  });
}

/** Status for any registered git root (project-tree SCM badges). */
export function useRootStatus(rootPath: string | null | undefined, enabled = true) {
  return useQuery({
    queryKey: ["status", rootPath],
    queryFn: () => api.getStatus(rootPath),
    enabled: enabled && !!rootPath,
    staleTime: 5000,
    structuralSharing: true,
  });
}

/** Decoration map for one git root; relative keys only when it is the active root. */
export function useRootScmMap(
  rootPath: string | null | undefined,
  options: { enabled?: boolean; includeRelativeKeys?: boolean } = {},
) {
  const enabled = options.enabled !== false;
  const includeRelativeKeys = options.includeRelativeKeys !== false;
  const { data } = useRootStatus(rootPath, enabled && !!rootPath);
  return useMemo(() => {
    if (!data || !rootPath) return undefined;
    return buildScmDecorationMap(data, rootPath, { includeRelativeKeys });
  }, [data, rootPath, includeRelativeKeys]);
}

export function useRepoInfo(enabled: boolean) {
  const activeGitRoot = useAppStore((s) => s.activeGitRoot);
  return useQuery({
    queryKey: ["repo-info", activeGitRoot],
    queryFn: api.getRepoInfo,
    enabled: enabled && !!activeGitRoot,
    staleTime: 5000,
  });
}

export function useBranches(enabled: boolean) {
  const activeGitRoot = useAppStore((s) => s.activeGitRoot);
  return useQuery({
    queryKey: ["branches", activeGitRoot],
    queryFn: () => api.getBranches(activeGitRoot),
    enabled: enabled && !!activeGitRoot,
    staleTime: 5000,
  });
}

export function useLog(skip: number, limit: number, enabled: boolean) {
  return useQuery({
    queryKey: ["log", skip, limit],
    queryFn: () => api.getLog(null, skip, limit),
    enabled,
  });
}

export function useRecentRepos() {
  return useQuery({
    queryKey: ["recent-repos"],
    queryFn: api.getRecentRepos,
  });
}

export function useSettings() {
  return useQuery({
    queryKey: ["settings"],
    queryFn: api.getSettings,
  });
}

export function useInvalidateRepo() {
  const queryClient = useQueryClient();
  const setRepo = useAppStore((s) => s.setRepo);

  return async () => {
    await invalidateGitState(queryClient);
    try {
      const info = await api.getRepoInfo();
      setRepo(info);
    } catch {
      setRepo(null);
    }
  };
}
