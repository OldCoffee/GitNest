import type { FileStatusKind } from "../lib/types";

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

const STATUS_LABELS: Record<FileStatusKind, string> = {
  modified: "M",
  added: "A",
  deleted: "D",
  renamed: "R",
  copied: "C",
  untracked: "?",
  conflicted: "U",
};

const STATUS_COLORS: Record<FileStatusKind, string> = {
  modified: "jb-status-modified",
  added: "jb-status-added",
  deleted: "jb-status-deleted",
  renamed: "jb-status-renamed",
  copied: "jb-status-copied",
  untracked: "jb-status-untracked",
  conflicted: "jb-status-conflicted",
};

export function statusBadge(status: FileStatusKind) {
  return {
    label: STATUS_LABELS[status],
    className: STATUS_COLORS[status],
  };
}

export function formatCommitDate(unix: number) {
  return new Date(unix * 1000).toLocaleString();
}

export function repoName(path: string) {
  const parts = path.split(/[/\\]/);
  return parts[parts.length - 1] || path;
}
