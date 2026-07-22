/** Pure helpers for terminal tab session bookkeeping (no PTY / Tauri). */

/** Basename for tab tooltips (spawn cwd); not a live shell cwd tracker. */
export function pathBasename(path: string): string {
  const normalized = path.replace(/\\/g, "/").replace(/\/+$/, "");
  const parts = normalized.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? path;
}

export function removeTerminalSession(sessions: number[], id: number): number[] {
  return sessions.filter((session) => session !== id);
}

export function nextActiveAfterClose(
  sessions: number[],
  closedId: number,
  active: number | null,
): number | null {
  if (active !== closedId) return active;
  const remaining = removeTerminalSession(sessions, closedId);
  return remaining[remaining.length - 1] ?? null;
}

/**
 * Decide what to do when a create() resolves after the panel may have unmounted.
 * - If still mounted: append the id.
 * - If disposed: keep list unchanged and signal the caller to close the orphan PTY.
 */
export function acceptCreatedSession(
  sessions: number[],
  id: number,
  disposed: boolean,
): { sessions: number[]; shouldClose: boolean } {
  if (disposed) {
    return { sessions, shouldClose: true };
  }
  if (sessions.includes(id)) {
    return { sessions, shouldClose: false };
  }
  return { sessions: [...sessions, id], shouldClose: false };
}

/** Ids that must be closed when the panel unmounts (tracked + any late creates). */
export function sessionsToCloseOnDispose(
  tracked: readonly number[],
  lateCreated: readonly number[],
): number[] {
  const ids = new Set<number>(tracked);
  for (const id of lateCreated) ids.add(id);
  return [...ids];
}
