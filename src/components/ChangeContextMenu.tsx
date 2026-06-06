import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { api } from "../lib/api";
import type { FileChange } from "../lib/types";
import { useAppStore } from "../store/appStore";
import { useT } from "../context/PreferencesContext";

type DiffMode = "working" | "staged";

interface ChangeContextMenuProps {
  file: FileChange;
  mode: DiffMode;
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

function isMacPlatform() {
  return typeof navigator !== "undefined" && /Mac/i.test(navigator.platform);
}

export function ChangeContextMenu({
  file,
  mode,
  x,
  y,
  onClose,
}: ChangeContextMenuProps) {
  const t = useT();
  const menuRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const openDiffEditor = useAppStore((s) => s.openDiffEditor);
  const openFileEditor = useAppStore((s) => s.openFileEditor);
  const mod = isMacPlatform() ? "⌘" : "Ctrl+";

  const isUntracked = file.status === "untracked";

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("mousedown", onMouseDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  function refreshStatus() {
    void queryClient.invalidateQueries({ queryKey: ["status"] });
    void queryClient.invalidateQueries({ queryKey: ["project-tree"] });
    void queryClient.invalidateQueries({ queryKey: ["project-entries"] });
  }

  function showDiff(newTab: boolean) {
    openDiffEditor({
      path: file.path,
      mode,
      id: newTab ? `${mode}:${file.path}:${Date.now()}` : `${mode}:${file.path}`,
    });
    onClose();
  }

  function jumpToSource() {
    openFileEditor(file.path);
    onClose();
  }

  async function commitFile() {
    try {
      await api.stageFiles([file.path]);
      refreshStatus();
      window.dispatchEvent(new Event("rebased:focus-commit"));
    } catch (e) {
      window.alert(String(e));
    }
    onClose();
  }

  async function addToVcs() {
    try {
      await api.stageFiles([file.path]);
      refreshStatus();
    } catch (e) {
      window.alert(String(e));
    }
    onClose();
  }

  async function rollback() {
    if (!window.confirm(t("changeMenu.rollbackConfirm", { path: file.path }))) {
      onClose();
      return;
    }
    try {
      if (isUntracked) {
        await api.deleteProjectEntry(file.path);
      } else {
        await api.discardChanges([file.path]);
      }
      refreshStatus();
    } catch (e) {
      window.alert(String(e));
    }
    onClose();
  }

  async function deleteFile() {
    if (!window.confirm(t("changeMenu.deleteConfirm", { path: file.path }))) {
      onClose();
      return;
    }
    try {
      await api.deleteProjectEntry(file.path);
      refreshStatus();
    } catch (e) {
      window.alert(String(e));
    }
    onClose();
  }

  const menuStyle = {
    left: Math.min(x, window.innerWidth - 260),
    top: Math.min(y, window.innerHeight - 320),
  };

  return (
    <div ref={menuRef} className="jb-context-menu" style={menuStyle}>
      <MenuItem label={t("changeMenu.commitFile")} onClick={() => void commitFile()} />
      <MenuItem label={t("changeMenu.rollback")} onClick={() => void rollback()} />
      <MenuSeparator />
      <MenuItem label={t("changeMenu.showDiff")} shortcut={`${mod}D`} onClick={() => showDiff(false)} />
      <MenuItem label={t("changeMenu.showDiffNewTab")} onClick={() => showDiff(true)} />
      <MenuItem label={t("changeMenu.jumpToSource")} onClick={jumpToSource} />
      <MenuSeparator />
      <MenuItem
        label={t("changeMenu.addToVcs")}
        disabled={!isUntracked}
        onClick={() => void addToVcs()}
      />
      <MenuItem label={t("changeMenu.delete")} onClick={() => void deleteFile()} />
    </div>
  );
}
