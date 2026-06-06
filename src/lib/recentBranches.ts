const STORAGE_KEY = "rebased.recentBranches";
const MAX_RECENT = 8;

type RecentMap = Record<string, string[]>;

function readAll(): RecentMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as RecentMap;
  } catch {
    return {};
  }
}

function writeAll(map: RecentMap) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

export function getRecentBranches(repoPath: string): string[] {
  return readAll()[repoPath] ?? [];
}

export function touchRecentBranch(repoPath: string, branchName: string) {
  const map = readAll();
  const prev = map[repoPath] ?? [];
  const next = [branchName, ...prev.filter((n) => n !== branchName)].slice(0, MAX_RECENT);
  map[repoPath] = next;
  writeAll(map);
}
