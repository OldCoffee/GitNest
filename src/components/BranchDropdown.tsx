import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import type { BranchInfo } from "../lib/types";
import { api } from "../lib/api";
import { getRecentBranches, touchRecentBranch } from "../lib/recentBranches";
import { useAppStore } from "../store/appStore";
import { useBranches, useInvalidateRepo } from "../hooks/useRepo";
import { useT } from "../context/PreferencesContext";
import { BranchTreeView } from "./BranchTreeView";

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
    [repo, open, branches],
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
    await queryClient.invalidateQueries({ queryKey: ["branches"] });
    await queryClient.invalidateQueries({ queryKey: ["log"] });
    await queryClient.invalidateQueries({ queryKey: ["status"] });
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

  function promptNewBranch() {
    if (!repo) return;
    const repoPath = repo.path;
    const name = window.prompt(t("branchPopup.newBranchPrompt"), "");
    if (!name?.trim()) return;
    setBusy(true);
    void api
      .createNewBranch(name.trim())
      .then(async () => {
        touchRecentBranch(repoPath, name.trim());
        await refreshAll();
        await api.checkoutBranch(name.trim());
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

  function promptCheckoutRevision() {
    const rev = window.prompt(t("branchPopup.checkoutRevisionPrompt"), "");
    if (!rev?.trim()) return;
    setBusy(true);
    void api
      .checkoutBranch(rev.trim())
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
            <svg className="jb-branch-popup-search-icon" viewBox="0 0 16 16" aria-hidden>
              <path
                fill="currentColor"
                d="M7 2.5a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9Zm0 1a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Zm4.78 7.22a.75.75 0 0 1 1.06 1.06l-2.5 2.5a.75.75 0 0 1-1.06-1.06l2.5-2.5Z"
              />
            </svg>
            <input
              className="jb-branch-popup-search"
              placeholder={t("branchPopup.searchPlaceholder")}
              value={filter}
              autoFocus
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>
          <div className="jb-branch-popup-header-tools">
            <button type="button" className="jb-branch-popup-tool" title={t("branchPopup.manageBranches")} onClick={() => { setOpen(false); openBranchesEditor(); }}>
              <svg viewBox="0 0 16 16" aria-hidden><path fill="currentColor" d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13Zm0 1a5.5 5.5 0 1 1 0 11 5.5 5.5 0 0 1 0-11Zm.75 2v2.19l1.72 1-.5.87L8 7.06 6.03 8.43l-.5-.87 1.72-1V4.5h1.5Z"/></svg>
            </button>
            <button type="button" className="jb-branch-popup-tool" title={t("branchPopup.settings")} onClick={() => { setOpen(false); openSettingsEditor(); }}>
              <svg viewBox="0 0 16 16" aria-hidden><path fill="currentColor" d="M8 4.75a3.25 3.25 0 1 0 0 6.5 3.25 3.25 0 0 0 0-6.5ZM5.1 2.2l.45 1.03a4.8 4.8 0 0 0-.86.5l-1-.58-.75 1.3 1 .58a4.9 4.9 0 0 0-.25 1v1.14l-1 .58.75 1.3 1-.58c.27.2.56.37.86.5l-.45 1.03h1.5l.45-1.03c.3-.13.59-.3.86-.5l1 .58.75-1.3-1-.58V6.5c0-.35.09-.68.25-1l1-.58-.75-1.3-1 .58a4.8 4.8 0 0 0-.86-.5l.45-1.03H5.1Z"/></svg>
            </button>
          </div>
        </div>

        {(showActions || matchesAction(t("branchPopup.updateProject"), filterTrim)) && (
          <div className="jb-branch-popup-actions">
            {matchesAction(t("branchPopup.updateProject"), filterTrim) && (
              <PopupActionRow
                icon={
                  <ActionIcon>
                    <svg viewBox="0 0 16 16" aria-hidden><path fill="currentColor" d="M8 2.5a5.5 5.5 0 0 1 5.45 4.7l1.02.2-.35 1.76-1.12-.22A4 4 0 1 0 12 8h1.5a6.5 6.5 0 1 1-6.35-5.5H8V2.5Z"/></svg>
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
                    <svg viewBox="0 0 16 16" aria-hidden><path fill="currentColor" d="M4 3.5a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Zm7.5 0a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0ZM6.2 6.8h3.6l.7 2.2h2.1l-2.8-4.2H6.2v2Zm0 0v1.9H4.1L2.5 11h2.3l.8-2.5h1.6V8.7Z"/></svg>
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
                    <svg viewBox="0 0 16 16" aria-hidden><path fill="currentColor" d="M8 3.5 4 7.5h2.5V12h3V7.5H12L8 3.5Z"/></svg>
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
                      <svg viewBox="0 0 16 16" aria-hidden><path fill="currentColor" d="M8 3.5v4H4v1h4v4h1v-4h4v-1H9v-4H8Z"/></svg>
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
                  icon={<ActionIcon><span /></ActionIcon>}
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
        <svg className="jb-branch-trigger-icon" viewBox="0 0 16 16" aria-hidden>
          <path
            fill="currentColor"
            d="M11.5 2.5a2 2 0 0 0-.75 3.85 2.75 2.75 0 0 1-2.6 1.86 3.7 3.7 0 0 0-1.65.4V5.6a2 2 0 1 0-1.5 0v4.8a2 2 0 1 0 1.55.06c.16-.5.6-1.16 1.6-1.16a4.25 4.25 0 0 0 4.1-3.06A2 2 0 0 0 11.5 2.5Zm-7 1a.5.5 0 1 1 0 1 .5.5 0 0 1 0-1Zm0 8a.5.5 0 1 1 0 1 .5.5 0 0 1 0-1Zm7-8a.5.5 0 1 1 0 1 .5.5 0 0 1 0-1Z"
          />
        </svg>
        <span className="jb-branch-trigger-name">{repo.branch}</span>
        <span className="jb-branch-trigger-chevron">▾</span>
      </button>
      {panel && createPortal(panel, document.body)}
    </>
  );
}
