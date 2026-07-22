import { api } from "./api";

const SESSION_KEY_PREFIX = "gitnest.workspace:";

function normalizePath(path: string): string {
  return path.replace(/\\/g, "/").replace(/\/+$/, "");
}

export function sameWorkspacePath(a: string, b: string): boolean {
  return normalizePath(a) === normalizePath(b);
}

function readPersistedExtraRoots(repoPath: string): string[] {
  try {
    const raw = localStorage.getItem(`${SESSION_KEY_PREFIX}${repoPath}`);
    if (!raw) return [];
    const session = JSON.parse(raw) as { workspaceRoots?: string[] };
    const roots = session.workspaceRoots ?? [];
    return roots.filter((root) => !sameWorkspacePath(root, repoPath));
  } catch {
    return [];
  }
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
