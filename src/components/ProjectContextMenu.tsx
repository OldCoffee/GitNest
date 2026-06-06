import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { api } from "../lib/api";
import {
  importTargetFromEntry,
  parentDirOfPath,
  pasteIntoProject,
  refreshProjectTree,
} from "../lib/projectTreeActions";
import type { ProjectEntry } from "../lib/types";
import { useAppStore } from "../store/appStore";
import { useT } from "../context/PreferencesContext";

interface ProjectContextMenuProps {
  entry: ProjectEntry | null;
  pasteParentPath: string | null;
  x: number;
  y: number;
  onClose: () => void;
}

function MenuItem({
  label,
  disabled,
  shortcut,
  onClick,
}: {
  label: string;
  disabled?: boolean;
  shortcut?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="jb-context-menu-item"
      disabled={disabled}
      onClick={onClick}
    >
      <span>{label}</span>
      {shortcut && <span className="jb-context-menu-shortcut">{shortcut}</span>}
    </button>
  );
}

function MenuSeparator() {
  return <div className="jb-context-menu-separator" />;
}

function Submenu({
  label,
  disabled,
  children,
}: {
  label: string;
  disabled?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="jb-context-menu-submenu-wrap"
      onMouseEnter={() => !disabled && setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button type="button" className="jb-context-menu-item" disabled={disabled}>
        <span>{label}</span>
        <span className="jb-context-menu-shortcut">›</span>
      </button>
      {open && !disabled && (
        <div className="jb-context-menu jb-context-menu-flyout">{children}</div>
      )}
    </div>
  );
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
  const mod = isMacPlatform() ? "⌘" : "Ctrl+";

  const pasteTarget = parentDirOf(entry, pasteParentPath);
  const canPaste = true;
  const canCutCopy = !!entry;
  const canRename = !!entry;
  const canAddToGitignore = !!entry && entry.name !== ".gitignore";
  const newParent = parentDirOf(entry, pasteParentPath);

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
    const name = window.prompt(t("projectMenu.newFilePrompt"), "");
    if (!name?.trim()) {
      onClose();
      return;
    }
    try {
      await api.createProjectFile(newParent, name.trim());
      await refresh();
    } catch (e) {
      window.alert(String(e));
    }
    onClose();
  }

  async function createDirectory() {
    const name = window.prompt(t("projectMenu.newDirPrompt"), "");
    if (!name?.trim()) {
      onClose();
      return;
    }
    try {
      await api.createProjectDirectory(newParent, name.trim());
      await refresh();
    } catch (e) {
      window.alert(String(e));
    }
    onClose();
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
        window.alert(t("projectMenu.pasteNothing"));
      } else {
        await refresh();
      }
    } catch (e) {
      window.alert(String(e));
    }
    onClose();
  }

  async function copyAbsolutePath() {
    if (!entry) return;
    try {
      const abs = await api.getProjectAbsolutePath(entry.path);
      await copyText(abs);
    } catch (e) {
      window.alert(String(e));
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
    const name = window.prompt(t("projectMenu.renamePrompt"), entry.name);
    if (!name?.trim() || name.trim() === entry.name) {
      onClose();
      return;
    }
    try {
      await api.renameProjectEntry(entry.path, name.trim());
      await refresh();
    } catch (e) {
      window.alert(String(e));
    }
    onClose();
  }

  async function addToGitignore() {
    if (!entry) return;
    try {
      await api.addToGitignore(entry.path);
      await refresh();
      void queryClient.invalidateQueries({ queryKey: ["status"] });
    } catch (e) {
      window.alert(String(e));
    }
    onClose();
  }

  const menuStyle = {
    left: Math.min(x, window.innerWidth - 240),
    top: Math.min(y, window.innerHeight - 420),
  };

  return (
    <div ref={menuRef} className="jb-context-menu" style={menuStyle}>
      <MenuItem label={t("projectMenu.refresh")} onClick={() => void refresh()} />
      <MenuSeparator />
      <Submenu label={t("projectMenu.new")}>
        <MenuItem label={t("projectMenu.newFile")} onClick={() => void createFile()} />
        <MenuItem label={t("projectMenu.newDirectory")} onClick={() => void createDirectory()} />
      </Submenu>
      <MenuSeparator />
      <MenuItem
        label={t("projectMenu.cut")}
        disabled={!canCutCopy}
        shortcut={`${mod}X`}
        onClick={cut}
      />
      <MenuItem
        label={t("projectMenu.copy")}
        disabled={!canCutCopy}
        shortcut={`${mod}C`}
        onClick={copyEntry}
      />
      <Submenu label={t("projectMenu.copyPath")} disabled={!canCutCopy}>
        <MenuItem label={t("projectMenu.copyAbsolute")} onClick={() => void copyAbsolutePath()} />
        <MenuItem label={t("projectMenu.copyRelative")} onClick={() => void copyRelativePath()} />
      </Submenu>
      <MenuItem
        label={t("projectMenu.paste")}
        disabled={!canPaste}
        shortcut={`${mod}V`}
        onClick={() => void paste()}
      />
      <MenuSeparator />
      <MenuItem
        label={t("projectMenu.rename")}
        disabled={!canRename}
        onClick={() => void renameEntry()}
      />
      <MenuItem
        label={t("projectMenu.addToGitignore")}
        disabled={!canAddToGitignore}
        onClick={() => void addToGitignore()}
      />
    </div>
  );
}
