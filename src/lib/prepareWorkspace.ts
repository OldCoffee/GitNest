import type { QueryClient } from "@tanstack/react-query";
import { api } from "./api";
import type { RepoInfo } from "./types";

export type WorkspaceOpenStep =
  | "openingRepo"
  | "loadingStatus"
  | "loadingBranches"
  | "ready";

/**
 * Open the repository and warm the queries MainLayout needs before switching UI,
 * so the first paint after enter does not stampede the backend.
 */
export async function prepareWorkspace(
  path: string,
  queryClient: QueryClient,
  onStep?: (step: WorkspaceOpenStep) => void,
): Promise<RepoInfo> {
  onStep?.("openingRepo");
  const info = await api.openRepository(path);

  onStep?.("loadingStatus");
  await queryClient.prefetchQuery({
    queryKey: ["status"],
    queryFn: api.getStatus,
    staleTime: 10_000,
  });

  onStep?.("loadingBranches");
  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: ["branches"],
      queryFn: api.getBranches,
      staleTime: 10_000,
    }),
    queryClient.prefetchQuery({
      queryKey: ["repo-operation-state"],
      queryFn: api.getRepoOperationState,
      staleTime: 10_000,
    }),
    queryClient.prefetchQuery({
      queryKey: ["repo-info"],
      queryFn: api.getRepoInfo,
      staleTime: 10_000,
    }),
    // Warm the default Project explorer so the left panel is not empty on enter.
    queryClient.prefetchQuery({
      queryKey: ["project-entries", ""],
      queryFn: () => api.listProjectEntries(null),
      staleTime: 10_000,
    }),
  ]);

  // Let the UI paint the final "ready" frame before unmounting the welcome page.
  onStep?.("ready");
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.setTimeout(() => resolve(), 48);
      });
    });
  });

  return info;
}
