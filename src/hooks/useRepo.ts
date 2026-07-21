import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listen } from "@tauri-apps/api/event";
import { useEffect } from "react";
import { api } from "../lib/api";
import { documentStore } from "../editor/documentStore";
import { javaLspClient } from "../editor/lspClient";
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

      if (gitChanged || workspacePaths.length > 0) {
        queryClient.invalidateQueries({ queryKey: ["status"] });
      }
      if (gitChanged) {
        queryClient.invalidateQueries({ queryKey: ["repo-info"] });
        queryClient.invalidateQueries({ queryKey: ["branches"] });
        queryClient.invalidateQueries({ queryKey: ["repo-operation-state"] });
      }
      if (workspacePaths.length > 0) {
        queryClient.invalidateQueries({ queryKey: ["project-entries"] });
        queryClient.invalidateQueries({ queryKey: ["project-tree"] });
        for (const path of workspacePaths) {
          if (documentStore.has(path) && !documentStore.isDirty(path)) {
            void documentStore.load(path, true);
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

export function useStatus(enabled: boolean) {
  return useQuery({
    queryKey: ["status"],
    queryFn: api.getStatus,
    enabled,
    refetchInterval: false,
    staleTime: 5000,
    structuralSharing: true,
  });
}

export function useRepoInfo(enabled: boolean) {
  return useQuery({
    queryKey: ["repo-info"],
    queryFn: api.getRepoInfo,
    enabled,
    staleTime: 5000,
  });
}

export function useBranches(enabled: boolean) {
  return useQuery({
    queryKey: ["branches"],
    queryFn: api.getBranches,
    enabled,
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
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["status"] }),
      queryClient.invalidateQueries({ queryKey: ["repo-info"] }),
      queryClient.invalidateQueries({ queryKey: ["branches"] }),
      queryClient.invalidateQueries({ queryKey: ["repo-operation-state"] }),
    ]);
    try {
      const info = await api.getRepoInfo();
      setRepo(info);
    } catch {
      setRepo(null);
    }
  };
}
