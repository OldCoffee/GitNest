import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listen } from "@tauri-apps/api/event";
import { useEffect, useRef } from "react";
import { api } from "../lib/api";
import { useAppStore } from "../store/appStore";

const STATUS_DEBOUNCE_MS = 400;

export function useRepoChangedListener() {
  const queryClient = useQueryClient();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    listen("repo-changed", () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["status"] });
        queryClient.invalidateQueries({ queryKey: ["repo-info"] });
      }, STATUS_DEBOUNCE_MS);
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
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
    staleTime: 2000,
    structuralSharing: true,
  });
}

export function useRepoInfo(enabled: boolean) {
  return useQuery({
    queryKey: ["repo-info"],
    queryFn: api.getRepoInfo,
    enabled,
  });
}

export function useBranches(enabled: boolean) {
  return useQuery({
    queryKey: ["branches"],
    queryFn: api.getBranches,
    enabled,
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
