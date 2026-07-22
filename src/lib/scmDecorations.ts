import type { FileChange, FileStatusKind, StatusSnapshot } from "./types";

const STATUS_PRIORITY: Record<FileStatusKind, number> = {
  conflicted: 0,
  deleted: 1,
  modified: 2,
  renamed: 3,
  copied: 4,
  added: 5,
  untracked: 6,
};

function normalizeSlashes(path: string): string {
  return path.replace(/\\/g, "/");
}

function preferStatus(current: FileStatusKind | undefined, next: FileStatusKind): FileStatusKind {
  if (!current) return next;
  return STATUS_PRIORITY[next] < STATUS_PRIORITY[current] ? next : current;
}

function collectChanges(snapshot: StatusSnapshot): FileChange[] {
  return [
    ...snapshot.conflicted,
    ...snapshot.staged,
    ...snapshot.unstaged,
    ...snapshot.untracked,
  ];
}

/** Relative path of a status entry under a workspace root. */
export function statusEntryRelPath(change: FileChange, rootPath: string): string {
  const path = normalizeSlashes(change.path);
  const root = normalizeSlashes(rootPath).replace(/\/+$/, "");
  if (path === root) return "";
  if (path.startsWith(`${root}/`)) {
    return path.slice(root.length + 1);
  }
  // Already relative (typical for active git root).
  return path.replace(/^\.\//, "");
}

export type BuildScmMapOptions = {
  /** When false, only absolute keys are stored (avoids collisions across roots). */
  includeRelativeKeys?: boolean;
};

/**
 * Build a map from tree entry path → status.
 * Absolute keys under the root are always included; relative keys are optional.
 */
export function buildScmDecorationMap(
  snapshot: StatusSnapshot,
  rootPath: string,
  options: BuildScmMapOptions = {},
): Map<string, FileStatusKind> {
  const includeRelativeKeys = options.includeRelativeKeys !== false;
  const map = new Map<string, FileStatusKind>();
  const root = normalizeSlashes(rootPath).replace(/\/+$/, "");

  const mark = (key: string, status: FileStatusKind) => {
    if (!key) return;
    map.set(key, preferStatus(map.get(key), status));
  };

  for (const change of collectChanges(snapshot)) {
    const rel = statusEntryRelPath(change, rootPath);
    if (!rel) continue;
    const abs = `${root}/${rel}`;
    mark(abs, change.status);
    // Root row (absolute path) shows aggregated dirty for multi-root headers.
    mark(root, change.status === "conflicted" ? "conflicted" : "modified");
    if (includeRelativeKeys) {
      mark(rel, change.status);
    }

    const parts = rel.split("/");
    for (let i = 1; i < parts.length; i += 1) {
      const parentRel = parts.slice(0, i).join("/");
      mark(`${root}/${parentRel}`, "modified");
      if (includeRelativeKeys) {
        mark(parentRel, "modified");
      }
    }
  }

  return map;
}

export function lookupScmStatus(
  map: Map<string, FileStatusKind> | undefined,
  entryPath: string,
): FileStatusKind | null {
  if (!map || map.size === 0) return null;
  return map.get(normalizeSlashes(entryPath)) ?? null;
}

/** Count leaf dirty files (relative keys preferred when present). */
export function countDirtyPaths(map: Map<string, FileStatusKind> | undefined): number {
  if (!map || map.size === 0) return 0;
  const keys = [...map.keys()];
  const preferRelative = keys.some((key) => !key.startsWith("/"));
  const scoped = keys.filter((key) => (preferRelative ? !key.startsWith("/") : true));
  return scoped.filter(
    (key) => !scoped.some((other) => other !== key && other.startsWith(`${key}/`)),
  ).length;
}

export function mergeScmMaps(
  maps: Array<Map<string, FileStatusKind> | undefined>,
): Map<string, FileStatusKind> {
  const merged = new Map<string, FileStatusKind>();
  for (const map of maps) {
    if (!map) continue;
    for (const [path, status] of map) {
      merged.set(path, preferStatus(merged.get(path), status));
    }
  }
  return merged;
}
