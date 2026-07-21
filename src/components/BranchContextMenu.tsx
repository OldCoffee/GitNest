import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import { openBranchCompareDiff, openBranchWorkingDiff } from "../lib/branchDiff";
import type { BranchInfo } from "../lib/types";
import { useAppStore } from "../store/appStore";
import { useInvalidateRepo } from "../hooks/useRepo";
import { useT } from "../context/PreferencesContext";
import {
  ConfirmDialog,
  ContextMenu,
  ContextMenuItem,
  ContextMenuSeparator,
  PromptDialog,
} from "./ui";

interface BranchContextMenuProps {
  branch: BranchInfo;
  currentBranch: string;
  selectedRemote: string;
  x: number;
  y: number;
  onClose: () => void;
  onBusyChange?: (busy: boolean) => void;
}

type PendingDialog =
  | { kind: "delete" }
  | { kind: "newBranch" }
  | { kind: "rename" };

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
  const [pending, setPending] = useState<PendingDialog | null>(null);

  const target = branch.name;
  const isRemote = branch.is_remote;
  const isCurrent = branch.is_current || target === currentBranch;
  const sameAsCurrent = target === currentBranch;

  useEffect(() => {
    if (pending) return;
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
  }, [onClose, pending]);

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

  function promptPush() {
    const localName = isRemote ? target.split("/").slice(1).join("/") : target;
    const remote = selectedRemote || "origin";
    void runOp(t("toolbar.push"), () => api.gitPush(remote, localName));
  }

  if (pending?.kind === "delete") {
    return (
      <ConfirmDialog
        danger
        message={
          isRemote
            ? t("branchMenu.deleteRemoteConfirm", { target })
            : t("branchMenu.deleteBranchConfirm", { target })
        }
        onConfirm={() => {
          if (isRemote) {
            void run(t("branchMenu.deleteRemoteBranch"), () => api.deleteRemoteBranch(target));
          } else {
            void run(t("branchMenu.deleteBranchAction"), () =>
              api.deleteExistingBranch(target, false),
            );
          }
        }}
        onCancel={onClose}
      />
    );
  }

  if (pending?.kind === "newBranch") {
    return (
      <PromptDialog
        title={t("branchMenu.newBranchFrom", { target })}
        message={t("branchMenu.newBranchFromPrompt", { target })}
        onConfirm={(name) => {
          void run(t("branchMenu.createBranch"), () => api.createBranchFrom(name, target));
        }}
        onCancel={onClose}
      />
    );
  }

  if (pending?.kind === "rename") {
    return (
      <PromptDialog
        title={t("branchMenu.renameEllipsis")}
        message={t("branchMenu.renamePrompt")}
        defaultValue={target}
        onConfirm={(name) => {
          if (name === target) {
            onClose();
            return;
          }
          void run(t("branchMenu.renameBranch"), () => api.renameBranch(target, name));
        }}
        onCancel={onClose}
      />
    );
  }

  return (
    <ContextMenu
      menuRef={menuRef}
      style={{
        left: Math.min(x, window.innerWidth - 320),
        top: Math.min(y, window.innerHeight - 420),
      }}
    >
      <ContextMenuItem
        label={t("branchMenu.checkout")}
        disabled={isCurrent}
        onClick={() => void run(t("branchMenu.checkout"), () => api.checkoutBranch(target))}
      />
      <ContextMenuItem
        label={t("branchMenu.newBranchFrom", { target })}
        onClick={() => setPending({ kind: "newBranch" })}
      />
      <ContextMenuItem
        label={t("branchMenu.checkoutRebase", { branch: currentBranch })}
        disabled={sameAsCurrent}
        onClick={() =>
          void run(t("branchMenu.checkoutAndRebase"), () =>
            api.checkoutAndRebaseOnto(target, currentBranch),
          )
        }
      />

      <ContextMenuSeparator />
      <ContextMenuItem
        label={t("branchMenu.compareWith", { branch: currentBranch })}
        disabled={sameAsCurrent}
        onClick={() =>
          void run(t("branchMenu.compareBranches"), async () => {
            await openBranchCompareDiff(currentBranch, target, openDiffEditor);
          })
        }
      />
      <ContextMenuItem
        label={t("branchMenu.showDiffWorking")}
        onClick={() =>
          void run(t("branchMenu.showDiff"), async () => {
            await openBranchWorkingDiff(target, openDiffEditor);
          })
        }
      />

      <ContextMenuSeparator />
      <ContextMenuItem
        label={t("branchMenu.rebaseOnto", { current: currentBranch, target })}
        disabled={sameAsCurrent}
        onClick={() =>
          void run(t("branchMenu.rebase"), () => api.rebaseCurrentOnto(currentBranch, target))
        }
      />
      <ContextMenuItem
        label={t("branchMenu.mergeInto", { target, current: currentBranch })}
        disabled={sameAsCurrent}
        onClick={() =>
          void run(t("branchMenu.merge"), () => api.mergeBranchInto(currentBranch, target))
        }
      />

      {isRemote ? (
        <>
          <ContextMenuSeparator />
          <ContextMenuItem
            label={t("branchMenu.pullRebase", { current: currentBranch })}
            onClick={() =>
              void run(t("branchMenu.pullWithRebase"), () =>
                api.pullRemoteIntoBranch(currentBranch, target, true),
              )
            }
          />
          <ContextMenuItem
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
          <ContextMenuSeparator />
          <ContextMenuItem
            label={t("branchMenu.update")}
            onClick={() => void run(t("branchMenu.updateBranch"), () => api.updateLocalBranch(target))}
          />
          <ContextMenuItem label={t("branchMenu.pushEllipsis")} onClick={promptPush} />
        </>
      )}

      <ContextMenuSeparator />
      {!isRemote && (
        <ContextMenuItem
          label={t("branchMenu.renameEllipsis")}
          shortcut="F2"
          onClick={() => setPending({ kind: "rename" })}
        />
      )}
      <ContextMenuItem
        label={t("branchMenu.delete")}
        danger
        onClick={() => setPending({ kind: "delete" })}
      />
    </ContextMenu>
  );
}
