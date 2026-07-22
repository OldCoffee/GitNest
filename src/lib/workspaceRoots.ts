import { api } from "./api";
import type { RepoInfo } from "./types";

const SESSION_KEY_PREFIX = "gitnest.workspace:";

function normalizePath(path: string): string {
  return path.replace(/\\/g, "/").replace(/\/+$/, "");
}

export function sameWorkspacePath(a: string, b: string): boolean {
  return normalizePath(a) === normalizePath(b);
}

function readSession(repoPath: string): {
  workspaceRoots?: string[];
  activeGitRoot?: string;
} | null {
  try {
    const raw = localStorage.getItem(`${SESSION_KEY_PREFIX}${repoPath}`);
    if (!raw) return null;
    return JSON.parse(raw) as { workspaceRoots?: string[]; activeGitRoot?: string };
  } catch {
    return null;
  }
}

function readPersistedExtraRoots(repoPath: string): string[] {
  const session = readSession(repoPath);
  const roots = session?.workspaceRoots ?? [];
  return roots.filter((root) => !sameWorkspacePath(root, repoPath));
}

export function readPersistedActiveGitRoot(repoPath: string): string | null {
  const session = readSession(repoPath);
  return session?.activeGitRoot ?? null;
}

/** Re-add folders stored with the last session for this git root. */
export async function restoreWorkspaceFolders(repoPath: string): Promise<string[]> {
  const extras = readPersistedExtraRoots(repoPath);
  for (const extra of extras) {
    try {
      await api.addWorkspaceFolder(extra);
    } catch {
      // Folder may have been deleted; skip and continue.
    }
  }
  try {
    const roots = await api.listWorkspaceRoots();
    return roots.length > 0 ? roots : [repoPath];
  } catch {
    return [repoPath];
  }
}

/**
 * After restoring folders, activate the session's preferred git root when valid.
 * Returns the active RepoInfo (may differ from the initially opened path).
 */
export async function restoreActiveGitRoot(
  opened: RepoInfo,
  roots: string[],
): Promise<{ info: RepoInfo; roots: string[] }> {
  const preferred = readPersistedActiveGitRoot(opened.path);
  if (
    !preferred ||
    sameWorkspacePath(preferred, opened.path) ||
    !roots.some((root) => sameWorkspacePath(root, preferred))
  ) {
    return { info: opened, roots };
  }
  try {
    const info = await api.activateGitRoot(preferred);
    const nextRoots = await api.listWorkspaceRoots();
    return { info, roots: nextRoots.length > 0 ? nextRoots : roots };
  } catch {
    return { info: opened, roots };
  }
}

export function workspaceRootLabel(rootPath: string, allRoots: string[]): string {
  const parts = normalizePath(rootPath).split("/").filter(Boolean);
  const base = parts[parts.length - 1] ?? rootPath;
  const collisions = allRoots.filter((root) => {
    const other = normalizePath(root).split("/").filter(Boolean);
    return other[other.length - 1] === base;
  }).length;
  if (collisions <= 1) return base;
  const parent = parts[parts.length - 2];
  return parent ? `${parent}/${base}` : base;
}
