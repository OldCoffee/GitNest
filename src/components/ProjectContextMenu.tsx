import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { api } from "../lib/api";
import {
  importTargetFromEntry,
  parentDirOfPath,
  pasteIntoProject,
  refreshProjectTree,
} from "../lib/projectTreeActions";
import { uiAlert, uiPrompt } from "../lib/uiPrompt";
import type { ProjectEntry } from "../lib/types";
import { sameWorkspacePath } from "../lib/workspaceRoots";
import { useAppStore } from "../store/appStore";
import { useT } from "../context/PreferencesContext";
import { ContextMenu, ContextMenuItem, ContextMenuSeparator, ContextMenuSubmenu } from "./ui";
import { invalidateStatus } from "../lib/queryInvalidation";

interface ProjectContextMenuProps {
  entry: ProjectEntry | null;
  pasteParentPath: string | null;
  workspaceRoot?: string | null;
  x: number;
  y: number;
  onClose: () => void;
}

function isMacPlatform() {
  return typeof navigator !== "undefined" && /Mac/i.test(navigator.platform);
}

async function copyText(text: string) {
  await navigator.clipboard?.writeText(text);
}

function parentDirOf(entry: ProjectEntry | null, fallback: string | null): string | null {
  if (!entry) return fallback;
  if (entry.is_dir) return entry.path;
  return parentDirOfPath(entry.path);
}

export function ProjectContextMenu({
  entry,
  pasteParentPath,
  workspaceRoot = null,
  x,
  y,
  onClose,
}: ProjectContextMenuProps) {
  const t = useT();
  const menuRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const projectClipboard = useAppStore((s) => s.projectClipboard);
  const setProjectClipboard = useAppStore((s) => s.setProjectClipboard);
  const setProjectImportTarget = useAppStore((s) => s.setProjectImportTarget);
  const setWorkspaceRoots = useAppStore((s) => s.setWorkspaceRoots);
  const repo = useAppStore((s) => s.repo);
  const mod = isMacPlatform() ? "⌘" : "Ctrl+";

  const pasteTarget = parentDirOf(entry, pasteParentPath);
  const canPaste = true;
  const canCutCopy = !!entry;
  const canRename = !!entry;
  const canAddToGitignore =
    !!entry &&
    entry.name !== ".gitignore" &&
    (!workspaceRoot || sameWorkspacePath(workspaceRoot, repo?.path ?? ""));
  const newParent = parentDirOf(entry, pasteParentPath);
  const canRemoveFolder =
    !!entry?.is_dir &&
    !!workspaceRoot &&
    sameWorkspacePath(entry.path, workspaceRoot) &&
    !!repo &&
    !sameWorkspacePath(workspaceRoot, repo.path);

  useEffect(() => {
    setProjectImportTarget(importTargetFromEntry(entry));
  }, [entry, setProjectImportTarget]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  async function refresh() {
    await refreshProjectTree(queryClient);
  }

  async function createFile() {
    onClose();
    const name = await uiPrompt({
      title: t("projectMenu.newFile"),
      message: t("projectMenu.newFilePrompt"),
    });
    if (!name) return;
    try {
      await api.createProjectFile(newParent, name, workspaceRoot);
      await refresh();
    } catch (e) {
      void uiAlert(String(e));
    }
  }

  async function createDirectory() {
    onClose();
    const name = await uiPrompt({
      title: t("projectMenu.newDirectory"),
      message: t("projectMenu.newDirPrompt"),
    });
    if (!name) return;
    try {
      await api.createProjectDirectory(newParent, name, workspaceRoot);
      await refresh();
    } catch (e) {
      void uiAlert(String(e));
    }
  }

  function cut() {
    if (!entry) return;
    setProjectClipboard({ mode: "cut", path: entry.path, is_dir: entry.is_dir });
    onClose();
  }

  function copyEntry() {
    if (!entry) return;
    setProjectClipboard({ mode: "copy", path: entry.path, is_dir: entry.is_dir });
    onClose();
  }

  async function paste() {
    try {
      const pasted = await pasteIntoProject(pasteTarget, projectClipboard, () =>
        setProjectClipboard(null),
      );
      if (!pasted) {
        void uiAlert(t("projectMenu.pasteNothing"));
      } else {
        await refresh();
      }
    } catch (e) {
      void uiAlert(String(e));
    }
    onClose();
  }

  async function copyAbsolutePath() {
    if (!entry) return;
    try {
      const abs = await api.getProjectAbsolutePath(entry.path);
      await copyText(abs);
    } catch (e) {
      void uiAlert(String(e));
    }
    onClose();
  }

  async function copyRelativePath() {
    if (!entry) return;
    await copyText(entry.path);
    onClose();
  }

  async function renameEntry() {
    if (!entry) return;
    onClose();
    const name = await uiPrompt({
      title: t("projectMenu.rename"),
      message: t("projectMenu.renamePrompt"),
      defaultValue: entry.name,
    });
    if (!name || name === entry.name) return;
    try {
      await api.renameProjectEntry(entry.path, name, workspaceRoot);
      await refresh();
    } catch (e) {
      void uiAlert(String(e));
    }
  }

  async function addToGitignore() {
    if (!entry) return;
    try {
      await api.addToGitignore(entry.path);
      await refresh();
      void invalidateStatus(queryClient);
    } catch (e) {
      void uiAlert(String(e));
    }
    onClose();
  }

  async function removeWorkspaceFolder() {
    if (!entry || !canRemoveFolder) return;
    try {
      const roots = await api.removeWorkspaceFolder(entry.path);
      setWorkspaceRoots(roots);
      await refresh();
    } catch (e) {
      void uiAlert(String(e));
    }
    onClose();
  }

  const menuStyle = {
    left: Math.min(x, window.innerWidth - 240),
    top: Math.min(y, window.innerHeight - 420),
  };

  return (
    <ContextMenu menuRef={menuRef} style={menuStyle}>
      <ContextMenuItem label={t("projectMenu.refresh")} onClick={() => void refresh()} />
      <ContextMenuSeparator />
      <ContextMenuSubmenu label={t("projectMenu.new")}>
        <ContextMenuItem label={t("projectMenu.newFile")} onClick={() => void createFile()} />
        <ContextMenuItem label={t("projectMenu.newDirectory")} onClick={() => void createDirectory()} />
      </ContextMenuSubmenu>
      <ContextMenuSeparator />
      <ContextMenuItem
        label={t("projectMenu.cut")}
        disabled={!canCutCopy}
        shortcut={`${mod}X`}
        onClick={cut}
      />
      <ContextMenuItem
        label={t("projectMenu.copy")}
        disabled={!canCutCopy}
        shortcut={`${mod}C`}
        onClick={copyEntry}
      />
      <ContextMenuSubmenu label={t("projectMenu.copyPath")} disabled={!canCutCopy}>
        <ContextMenuItem label={t("projectMenu.copyAbsolute")} onClick={() => void copyAbsolutePath()} />
        <ContextMenuItem label={t("projectMenu.copyRelative")} onClick={() => void copyRelativePath()} />
      </ContextMenuSubmenu>
      <ContextMenuItem
        label={t("projectMenu.paste")}
        disabled={!canPaste}
        shortcut={`${mod}V`}
        onClick={() => void paste()}
      />
      <ContextMenuSeparator />
      <ContextMenuItem
        label={t("projectMenu.rename")}
        disabled={!canRename}
        onClick={() => void renameEntry()}
      />
      <ContextMenuItem
        label={t("projectMenu.addToGitignore")}
        disabled={!canAddToGitignore}
        onClick={() => void addToGitignore()}
      />
      {canRemoveFolder && (
        <>
          <ContextMenuSeparator />
          <ContextMenuItem
            label={t("projectMenu.removeFromWorkspace")}
            onClick={() => void removeWorkspaceFolder()}
          />
        </>
      )}
    </ContextMenu>
  );
}
