import type { QueryClient } from "@tanstack/react-query";
import { api } from "./api";
import { invalidateProject } from "./queryInvalidation";
import type { ProjectClipboard } from "./types";

export function invalidateProjectTree(queryClient: QueryClient) {
  void invalidateProject(queryClient);
}

export async function refreshProjectTree(queryClient: QueryClient) {
  await Promise.all([
    queryClient.resetQueries({ queryKey: ["project-entries"] }),
    queryClient.resetQueries({ queryKey: ["project-tree"] }),
  ]);
}

export function parentDirOfPath(path: string | null): string | null {
  if (!path) return null;
  const slash = path.lastIndexOf("/");
  return slash === -1 ? null : path.slice(0, slash);
}

export function importTargetFromEntry(
  entry: { path: string; is_dir: boolean } | null,
): string | null {
  if (!entry) return null;
  if (entry.is_dir) return entry.path;
  return parentDirOfPath(entry.path);
}

export async function pasteProjectClipboard(
  clipboard: ProjectClipboard,
  destDirPath: string | null,
  clearClipboard: () => void,
): Promise<void> {
  if (clipboard.mode === "cut") {
    await api.moveProjectEntry(clipboard.path, destDirPath);
    clearClipboard();
  } else {
    await api.copyProjectEntry(clipboard.path, destDirPath);
  }
}

export async function pasteIntoProject(
  destDirPath: string | null,
  clipboard: ProjectClipboard | null,
  clearClipboard: () => void,
): Promise<boolean> {
  if (clipboard) {
    await pasteProjectClipboard(clipboard, destDirPath, clearClipboard);
    return true;
  }
  const externalPaths = await api.getClipboardFilePaths();
  if (externalPaths.length === 0) return false;
  await api.importExternalEntries(externalPaths, destDirPath);
  return true;
}
