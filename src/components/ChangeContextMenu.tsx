import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import type { FileChange } from "../lib/types";
import { useAppStore } from "../store/appStore";
import { useT } from "../context/PreferencesContext";
import { useDiscardConfirm } from "../hooks/useDiscardConfirm";
import { ConfirmDialog, ContextMenu, ContextMenuItem, ContextMenuSeparator } from "./ui";
import { uiAlert } from "../lib/uiPrompt";
import {
  invalidateProject,
  invalidateStatus,
} from "../lib/queryInvalidation";

type DiffMode = "working" | "staged";
type PendingConfirm = "delete";

interface ChangeContextMenuProps {
  file: FileChange;
  mode: DiffMode;
  x: number;
  y: number;
  onClose: () => void;
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
  const commitRepoPath = useAppStore((s) => s.commitRepoPath ?? s.activeGitRoot);
  const mod = isMacPlatform() ? "⌘" : "Ctrl+";
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const {
    pending: discardPending,
    requestDiscard,
    cancel: cancelDiscard,
    confirm: confirmDiscard,
  } = useDiscardConfirm();

  const isUntracked = file.status === "untracked";

  useEffect(() => {
    if (pending) return;
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
  }, [onClose, pending]);

  function refreshStatus() {
    void invalidateStatus(queryClient);
    void invalidateProject(queryClient);
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
      await api.stageFiles([file.path], commitRepoPath);
      refreshStatus();
      window.dispatchEvent(new Event("rebased:focus-commit"));
    } catch (e) {
      void uiAlert(String(e));
    }
    onClose();
  }

  async function addToVcs() {
    try {
      await api.stageFiles([file.path], commitRepoPath);
      refreshStatus();
    } catch (e) {
      void uiAlert(String(e));
    }
    onClose();
  }

  async function runRollback() {
    try {
      if (isUntracked) {
        await api.deleteProjectEntry(file.path);
      } else {
        await api.discardChanges([file.path], commitRepoPath);
      }
      refreshStatus();
    } catch (e) {
      void uiAlert(String(e));
    }
    onClose();
  }

  async function runDelete() {
    try {
      await api.deleteProjectEntry(file.path);
      refreshStatus();
    } catch (e) {
      void uiAlert(String(e));
    }
    onClose();
  }

  const menuStyle = {
    left: Math.min(x, window.innerWidth - 260),
    top: Math.min(y, window.innerHeight - 320),
  };

  if (discardPending) {
    return (
      <ConfirmDialog
        danger
        message={discardPending.message}
        onConfirm={() => {
          confirmDiscard();
        }}
        onCancel={() => {
          cancelDiscard();
          onClose();
        }}
      />
    );
  }

  if (pending === "delete") {
    return (
      <ConfirmDialog
        danger
        message={t("changeMenu.deleteConfirm", { path: file.path })}
        onConfirm={() => void runDelete()}
        onCancel={onClose}
      />
    );
  }

  return (
    <ContextMenu menuRef={menuRef} style={menuStyle}>
      <ContextMenuItem label={t("changeMenu.commitFile")} onClick={() => void commitFile()} />
      <ContextMenuItem
        label={t("changeMenu.rollback")}
        onClick={() =>
          requestDiscard(t("changeMenu.rollbackConfirm", { path: file.path }), () => {
            void runRollback();
          })
        }
      />
      <ContextMenuSeparator />
      <ContextMenuItem
        label={t("changeMenu.showDiff")}
        shortcut={`${mod}D`}
        onClick={() => showDiff(false)}
      />
      <ContextMenuItem label={t("changeMenu.showDiffNewTab")} onClick={() => showDiff(true)} />
      <ContextMenuItem label={t("changeMenu.jumpToSource")} onClick={jumpToSource} />
      <ContextMenuSeparator />
      <ContextMenuItem
        label={t("changeMenu.addToVcs")}
        disabled={!isUntracked}
        onClick={() => void addToVcs()}
      />
      <ContextMenuItem
        label={t("changeMenu.delete")}
        danger
        onClick={() => setPending("delete")}
      />
    </ContextMenu>
  );
}
