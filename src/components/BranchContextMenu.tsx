import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { api } from "../lib/api";
import { openBranchCompareDiff, openBranchWorkingDiff } from "../lib/branchDiff";
import type { BranchInfo } from "../lib/types";
import { useAppStore } from "../store/appStore";
import { useInvalidateRepo } from "../hooks/useRepo";
import { useT } from "../context/PreferencesContext";

interface BranchContextMenuProps {
  branch: BranchInfo;
  currentBranch: string;
  selectedRemote: string;
  x: number;
  y: number;
  onClose: () => void;
  onBusyChange?: (busy: boolean) => void;
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

export function BranchContextMenu({
  branch,
  currentBranch,
  selectedRemote,
  x,
  y,
  onClose,
  onBusyChange,
}: BranchContextMenuProps) {
  const t = useT();
  const menuRef = useRef<HTMLDivElement>(null);
  const appendVcsOutput = useAppStore((s) => s.appendVcsOutput);
  const setBottomToolWindow = useAppStore((s) => s.setBottomToolWindow);
  const openDiffEditor = useAppStore((s) => s.openDiffEditor);
  const invalidate = useInvalidateRepo();
  const queryClient = useQueryClient();

  const target = branch.name;
  const isRemote = branch.is_remote;
  const isCurrent = branch.is_current || target === currentBranch;
  const sameAsCurrent = target === currentBranch;

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

  async function refreshAll() {
    await invalidate();
    await queryClient.invalidateQueries({ queryKey: ["branches"] });
    await queryClient.invalidateQueries({ queryKey: ["log"] });
    await queryClient.invalidateQueries({ queryKey: ["status"] });
    await queryClient.invalidateQueries({ queryKey: ["repo-operation-state"] });
  }

  async function run(label: string, action: () => Promise<void | string>) {
    setBottomToolWindow("vcsConsole");
    onBusyChange?.(true);
    try {
      const result = await action();
      appendVcsOutput(
        typeof result === "string" ? result : t("common.actionCompleted", { action: label }),
      );
      await refreshAll();
    } catch (e) {
      appendVcsOutput(String(e));
    } finally {
      onBusyChange?.(false);
      onClose();
    }
  }

  async function runOp(label: string, action: () => Promise<{ output: string }>) {
    setBottomToolWindow("vcsConsole");
    onBusyChange?.(true);
    try {
      const result = await action();
      appendVcsOutput(result.output || t("common.actionCompleted", { action: label }));
      await refreshAll();
    } catch (e) {
      appendVcsOutput(String(e));
    } finally {
      onBusyChange?.(false);
      onClose();
    }
  }

  function promptNewBranchFrom() {
    const name = window.prompt(t("branchMenu.newBranchFromPrompt", { target }), "");
    if (!name?.trim()) {
      onClose();
      return;
    }
    void run(t("branchMenu.createBranch"), () => api.createBranchFrom(name.trim(), target));
  }

  function promptRename() {
    const name = window.prompt(t("branchMenu.renamePrompt"), target);
    if (!name?.trim() || name.trim() === target) {
      onClose();
      return;
    }
    void run(t("branchMenu.renameBranch"), () => api.renameBranch(target, name.trim()));
  }

  function promptPush() {
    const localName = isRemote ? target.split("/").slice(1).join("/") : target;
    const remote = selectedRemote || "origin";
    void runOp(t("toolbar.push"), () => api.gitPush(remote, localName));
  }

  function promptDelete() {
    if (isRemote) {
      if (!confirm(t("branchMenu.deleteRemoteConfirm", { target }))) {
        onClose();
        return;
      }
      void run(t("branchMenu.deleteRemoteBranch"), () => api.deleteRemoteBranch(target));
      return;
    }
    if (!confirm(t("branchMenu.deleteBranchConfirm", { target }))) {
      onClose();
      return;
    }
    void run(t("branchMenu.deleteBranchAction"), () => api.deleteExistingBranch(target, false));
  }

  const menuStyle = {
    left: Math.min(x, window.innerWidth - 320),
    top: Math.min(y, window.innerHeight - 420),
  };

  return (
    <div ref={menuRef} className="jb-context-menu" style={menuStyle}>
      <MenuItem
        label={t("branchMenu.checkout")}
        disabled={isCurrent}
        onClick={() => void run(t("branchMenu.checkout"), () => api.checkoutBranch(target))}
      />
      <MenuItem
        label={t("branchMenu.newBranchFrom", { target })}
        onClick={promptNewBranchFrom}
      />
      <MenuItem
        label={t("branchMenu.checkoutRebase", { branch: currentBranch })}
        disabled={sameAsCurrent}
        onClick={() =>
          void run(t("branchMenu.checkoutAndRebase"), () =>
            api.checkoutAndRebaseOnto(target, currentBranch),
          )
        }
      />

      <MenuSeparator />
      <MenuItem
        label={t("branchMenu.compareWith", { branch: currentBranch })}
        disabled={sameAsCurrent}
        onClick={() =>
          void run(t("branchMenu.compareBranches"), async () => {
            await openBranchCompareDiff(currentBranch, target, openDiffEditor);
          })
        }
      />
      <MenuItem
        label={t("branchMenu.showDiffWorking")}
        onClick={() =>
          void run(t("branchMenu.showDiff"), async () => {
            await openBranchWorkingDiff(target, openDiffEditor);
          })
        }
      />

      <MenuSeparator />
      <MenuItem
        label={t("branchMenu.rebaseOnto", { current: currentBranch, target })}
        disabled={sameAsCurrent}
        onClick={() =>
          void run(t("branchMenu.rebase"), () => api.rebaseCurrentOnto(currentBranch, target))
        }
      />
      <MenuItem
        label={t("branchMenu.mergeInto", { target, current: currentBranch })}
        disabled={sameAsCurrent}
        onClick={() =>
          void run(t("branchMenu.merge"), () => api.mergeBranchInto(currentBranch, target))
        }
      />

      {isRemote ? (
        <>
          <MenuSeparator />
          <MenuItem
            label={t("branchMenu.pullRebase", { current: currentBranch })}
            onClick={() =>
              void run(t("branchMenu.pullWithRebase"), () =>
                api.pullRemoteIntoBranch(currentBranch, target, true),
              )
            }
          />
          <MenuItem
            label={t("branchMenu.pullMerge", { current: currentBranch })}
            onClick={() =>
              void run(t("branchMenu.pullWithMerge"), () =>
                api.pullRemoteIntoBranch(currentBranch, target, false),
              )
            }
          />
        </>
      ) : (
        <>
          <MenuSeparator />
          <MenuItem
            label={t("branchMenu.update")}
            onClick={() => void run(t("branchMenu.updateBranch"), () => api.updateLocalBranch(target))}
          />
          <MenuItem label={t("branchMenu.pushEllipsis")} onClick={promptPush} />
        </>
      )}

      <MenuSeparator />
      {!isRemote && (
        <MenuItem label={t("branchMenu.renameEllipsis")} shortcut="F2" onClick={promptRename} />
      )}
      <MenuItem label={t("branchMenu.delete")} onClick={promptDelete} />
    </div>
  );
}
