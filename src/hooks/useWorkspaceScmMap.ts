import { useQueries } from "@tanstack/react-query";
import { api } from "../lib/api";
import {
  buildScmDecorationMap,
  mergeScmMaps,
} from "../lib/scmDecorations";
import type { FileStatusKind } from "../lib/types";
import { sameWorkspacePath } from "../lib/workspaceRoots";

/**
 * Merged SCM decoration map for all git roots in the workspace.
 * Relative keys are only stored for the active git root to avoid collisions.
 */
export function useWorkspaceScmMap(
  roots: string[],
  activeGitRoot: string | null | undefined,
): Map<string, FileStatusKind> | undefined {
  const gitFlags = useQueries({
    queries: roots.map((root) => ({
      queryKey: ["is-git-repository", root] as const,
      queryFn: () => api.isGitRepository(root),
      staleTime: 60_000,
    })),
  });

  const gitRoots = roots.filter((_, index) => gitFlags[index]?.data === true);

  const statusQueries = useQueries({
    queries: gitRoots.map((root) => ({
      queryKey: ["status", root] as const,
      queryFn: () => api.getStatus(root),
      staleTime: 5000,
    })),
  });

  if (gitRoots.length === 0) return undefined;

  const maps = gitRoots.map((root, index) => {
    const snapshot = statusQueries[index]?.data;
    if (!snapshot) return undefined;
    return buildScmDecorationMap(snapshot, root, {
      includeRelativeKeys: sameWorkspacePath(root, activeGitRoot ?? ""),
    });
  });
  const merged = mergeScmMaps(maps);
  return merged.size > 0 ? merged : undefined;
}
