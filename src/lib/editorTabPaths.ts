import type { EditorTab } from "./types";
import { isJdtUri, jdtDisplayName } from "../editor/lspClient";

export function isEditorTabClosable(tab: EditorTab): boolean {
  return tab.kind !== "welcome";
}

export function editorTabFilePath(tab: EditorTab): string | null {
  if (tab.kind === "file") return tab.filePath ?? null;
  if (tab.kind !== "diff" || !tab.diff) return null;
  return tab.diff.path;
}

export function editorTabAbsolutePath(tab: EditorTab, repoPath: string | undefined): string | null {
  const rel = editorTabFilePath(tab);
  if (!rel) return null;
  if (isJdtUri(rel)) return null;
  if (rel.startsWith("/") || /^[A-Za-z]:[\\/]/.test(rel)) return rel;
  if (!repoPath) return rel;
  return `${repoPath.replace(/[/\\]+$/, "")}/${rel.replace(/^[/\\]+/, "")}`;
}

export function editorTabRelativePath(tab: EditorTab): string | null {
  const path = editorTabFilePath(tab);
  if (!path) return null;
  if (isJdtUri(path)) return null;
  return path;
}

export function editorTabFileName(tab: EditorTab): string | null {
  const path = editorTabFilePath(tab);
  if (!path) return null;
  if (isJdtUri(path)) return jdtDisplayName(path);
  const parts = path.split(/[/\\]/);
  return parts[parts.length - 1] ?? path;
}

export async function copyText(text: string) {
  await navigator.clipboard.writeText(text);
}

export function sortEditorTabsPinnedFirst(tabs: EditorTab[]): EditorTab[] {
  const pinned = tabs.filter((t) => t.pinned);
  const unpinned = tabs.filter((t) => !t.pinned);
  return [...pinned, ...unpinned];
}

export function pickActiveAfterClose(
  tabs: EditorTab[],
  previousActiveId: string | null,
): string | null {
  if (tabs.length === 0) return null;
  if (previousActiveId && tabs.some((t) => t.id === previousActiveId)) {
    return previousActiveId;
  }
  return tabs[tabs.length - 1]?.id ?? null;
}
