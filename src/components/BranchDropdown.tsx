import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import type { BranchInfo } from "../lib/types";
import { api } from "../lib/api";
import { getRecentBranches, touchRecentBranch } from "../lib/recentBranches";
import { uiPrompt } from "../lib/uiPrompt";
import { useAppStore } from "../store/appStore";
import { useBranches, useInvalidateRepo } from "../hooks/useRepo";
import { useT } from "../context/PreferencesContext";
import { BranchTreeView } from "./BranchTreeView";
import { invalidateAfterGitMutation } from "../lib/queryInvalidation";
import {
  CheckIcon,
  ChevronDownIcon,
  GitIcon,
  IconButton,
  PlusIcon,
  PushIcon,
  RefreshIcon,
  SearchIcon,
  SettingsIcon,
} from "./ui";

function ActionIcon({ children }: { children: ReactNode }) {
  return <span className="jb-branch-popup-action-icon">{children}</span>;
}

function Shortcut({ keys }: { keys: string }) {
  return <span className="jb-branch-popup-shortcut">{keys}</span>;
}

function PopupActionRow({
  icon,
  label,
  shortcut,
  onClick,
  disabled,
}: {
  icon: ReactNode;
  label: string;
  shortcut?: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className="jb-branch-popup-action"
      disabled={disabled}
      onClick={onClick}
    >
      <span className="jb-branch-popup-action-left">
        {icon}
        <span>{label}</span>
      </span>
      {shortcut && <Shortcut keys={shortcut} />}
    </button>
  );
}

function matchesAction(label: string, filter: string) {
  return !filter || label.toLowerCase().includes(filter.toLowerCase());
}

export function BranchDropdown() {
  const t = useT();
  const repo = useAppStore((s) => s.repo);
  const selectedRemote = useAppStore((s) => s.selectedRemote);
  const appendVcsOutput = useAppStore((s) => s.appendVcsOutput);
  const setBottomToolWindow = useAppStore((s) => s.setBottomToolWindow);
  const openBranchesEditor = useAppStore((s) => s.openBranchesEditor);
  const openSettingsEditor = useAppStore((s) => s.openSettingsEditor);
  const setLeftToolWindow = useAppStore((s) => s.setLeftToolWindow);
  const setCommitTwTab = useAppStore((s) => s.setCommitTwTab);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const [busy, setBusy] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [panelPos, setPanelPos] = useState({ top: 0, left: 0 });
  const { data: branches = [], refetch, isFetching } = useBranches(!!repo);
  const invalidate = useInvalidateRepo();
  const queryClient = useQueryClient();

  const recentNames = useMemo(
    () => (repo ? getRecentBranches(repo.path) : []),
    [repo],
  );

  useEffect(() => {
    if (!open || !buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    setPanelPos({ top: rect.bottom + 4, left: Math.max(8, rect.left - 80) });
    void refetch();
  }, [open, refetch]);

  if (!repo) return null;

  const filterTrim = filter.trim();
  const showActions = !filterTrim;

  async function refreshAll() {
    await invalidate();
    await invalidateAfterGitMutation(queryClient);
  }

  async function checkout(branch: BranchInfo) {
    if (!repo) return;
    const repoPath = repo.path;
    setBusy(true);
    try {
      await api.checkoutBranch(branch.name);
      touchRecentBranch(
        repoPath,
        branch.is_remote ? branch.name.split("/").slice(1).join("/") : branch.name,
      );
      await refreshAll();
      setOpen(false);
      setFilter("");
    } catch (e) {
      appendVcsOutput(String(e));
      setBottomToolWindow("vcsConsole");
    } finally {
      setBusy(false);
    }
  }

  async function runRemote(label: string, action: () => Promise<{ output: string }>) {
    setBottomToolWindow("vcsConsole");
    setBusy(true);
    try {
      const result = await action();
      appendVcsOutput(result.output || t("common.actionCompleted", { action: label }));
      await refreshAll();
    } catch (e) {
      appendVcsOutput(String(e));
    } finally {
      setBusy(false);
    }
  }

  function focusCommit() {
    setLeftToolWindow("git");
    setCommitTwTab("local");
    window.dispatchEvent(new Event("rebased:focus-commit"));
    setOpen(false);
  }

  async function promptNewBranch() {
    if (!repo) return;
    const repoPath = repo.path;
    const name = await uiPrompt({
      message: t("branchPopup.newBranchPrompt"),
    });
    if (!name) return;
    setBusy(true);
    void api
      .createNewBranch(name)
      .then(async () => {
        touchRecentBranch(repoPath, name);
        await refreshAll();
        await api.checkoutBranch(name);
        await refreshAll();
        setOpen(false);
        setFilter("");
      })
      .catch((e) => {
        appendVcsOutput(String(e));
        setBottomToolWindow("vcsConsole");
      })
      .finally(() => setBusy(false));
  }

  async function promptCheckoutRevision() {
    const rev = await uiPrompt({
      message: t("branchPopup.checkoutRevisionPrompt"),
    });
    if (!rev) return;
    setBusy(true);
    void api
      .checkoutBranch(rev)
      .then(async () => {
        await refreshAll();
        setOpen(false);
        setFilter("");
      })
      .catch((e) => {
        appendVcsOutput(String(e));
        setBottomToolWindow("vcsConsole");
      })
      .finally(() => setBusy(false));
  }

  const panel = open ? (
    <>
      <div className="fixed inset-0 z-[100]" onClick={() => setOpen(false)} />
      <div
        className="jb-branch-popup fixed z-[101] flex flex-col"
        style={{ top: panelPos.top, left: panelPos.left }}
      >
        <div className="jb-branch-popup-header">
          <div className="jb-branch-popup-search-wrap">
            <SearchIcon size="sm" className="jb-branch-popup-search-icon" />
            <input
              className="jb-branch-popup-search"
              placeholder={t("branchPopup.searchPlaceholder")}
              value={filter}
              autoFocus
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>
          <div className="jb-branch-popup-header-tools">
            <IconButton
              surface="branchTool"
              label={t("branchPopup.manageBranches")}
              onClick={() => { setOpen(false); openBranchesEditor(); }}
            >
              <GitIcon size="sm" />
            </IconButton>
            <IconButton
              surface="branchTool"
              label={t("branchPopup.settings")}
              onClick={() => { setOpen(false); openSettingsEditor(); }}
            >
              <SettingsIcon size="sm" />
            </IconButton>
          </div>
        </div>

        {(showActions || matchesAction(t("branchPopup.updateProject"), filterTrim)) && (
          <div className="jb-branch-popup-actions">
            {matchesAction(t("branchPopup.updateProject"), filterTrim) && (
              <PopupActionRow
                icon={
                  <ActionIcon>
                    <RefreshIcon size="sm" />
                  </ActionIcon>
                }
                label={t("branchPopup.updateProject")}
                shortcut="⌘T"
                disabled={busy}
                onClick={() =>
                  void runRemote(t("branchPopup.updateProject"), () =>
                    api.gitPull(selectedRemote, repo.branch),
                  )
                }
              />
            )}
            {matchesAction(t("branchPopup.commit"), filterTrim) && (
              <PopupActionRow
                icon={
                  <ActionIcon>
                    <GitIcon size="sm" />
                  </ActionIcon>
                }
                label={t("branchPopup.commit")}
                shortcut="⌘K"
                onClick={focusCommit}
              />
            )}
            {matchesAction(t("branchPopup.push"), filterTrim) && (
              <PopupActionRow
                icon={
                  <ActionIcon>
                    <PushIcon size="sm" />
                  </ActionIcon>
                }
                label={t("branchPopup.push")}
                shortcut="⇧⌘K"
                disabled={busy}
                onClick={() =>
                  void runRemote(t("branchPopup.push"), () => api.gitPush(selectedRemote, repo.branch))
                }
              />
            )}
          </div>
        )}

        {(showActions || matchesAction(t("branchPopup.newBranch"), filterTrim) || matchesAction(t("branchPopup.checkoutTag"), filterTrim)) && (
          <>
            <div className="jb-branch-popup-separator" />
            <div className="jb-branch-popup-actions">
              {matchesAction(t("branchPopup.newBranch"), filterTrim) && (
                <PopupActionRow
                  icon={
                    <ActionIcon>
                      <PlusIcon size="sm" />
                    </ActionIcon>
                  }
                  label={t("branchPopup.newBranch")}
                  shortcut="⌥N"
                  disabled={busy}
                  onClick={promptNewBranch}
                />
              )}
              {matchesAction(t("branchPopup.checkoutTag"), filterTrim) && (
                <PopupActionRow
                  icon={
                    <ActionIcon>
                      <CheckIcon size="sm" />
                    </ActionIcon>
                  }
                  label={t("branchPopup.checkoutTag")}
                  disabled={busy}
                  onClick={promptCheckoutRevision}
                />
              )}
            </div>
          </>
        )}

        <div className="jb-branch-popup-separator" />

        <div className="jb-branch-popup-tree min-h-0 flex-1 overflow-auto">
          {isFetching && branches.length === 0 ? (
            <div className="px-3 py-2 text-xs jb-text-dim">{t("common.loading")}</div>
          ) : (
            <BranchTreeView
              branches={branches}
              variant="popup"
              recentBranchNames={recentNames}
              filter={filterTrim}
              onSelect={checkout}
              busy={busy}
              showContextMenu
            />
          )}
        </div>
      </div>
    </>
  ) : null;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="jb-branch-trigger"
        onClick={() => setOpen((v) => !v)}
        title={t("branchPopup.switchBranch")}
      >
        <GitIcon size="sm" className="jb-branch-trigger-icon" />
        <span className="jb-branch-trigger-name">{repo.branch}</span>
        <span className="jb-branch-trigger-chevron">
          <ChevronDownIcon size="xs" />
        </span>
      </button>
      {panel && createPortal(panel, document.body)}
    </>
  );
}
