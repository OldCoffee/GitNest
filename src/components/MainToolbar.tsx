import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { openPath, revealItemInDir } from "@tauri-apps/plugin-opener";
import { api } from "../lib/api";
import { refreshProjectTree } from "../lib/projectTreeActions";
import { repoName } from "../lib/utils";
import { useAppStore } from "../store/appStore";
import { useBranches, useInvalidateRepo } from "../hooks/useRepo";
import { BranchDropdown } from "./BranchDropdown";
import { GitOperationsActions } from "./GitOperationsActions";
import { Badge, Button, Select } from "./ui";
import {
  CloseRepoIcon,
  ExternalLinkIcon,
  FetchIcon,
  FolderIcon,
  NewWindowIcon,
  PullIcon,
  PushIcon,
  RefreshIcon,
  SettingsIcon,
} from "./ui/icons";
import { useT } from "../context/PreferencesContext";
import { uiAlert } from "../lib/uiPrompt";

function RepoIcon() {
  return <FolderIcon size="sm" />;
}

function OpenFolderIcon() {
  return <ExternalLinkIcon size="sm" className="jb-toolbar-repo-open" />;
}

function MergeRebaseWidget() {
  const t = useT();
  const repo = useAppStore((s) => s.repo);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setReady(true), 5000);
    return () => window.clearTimeout(id);
  }, [repo?.path]);
  const { data: state } = useQuery({
    queryKey: ["repo-operation-state"],
    queryFn: api.getRepoOperationState,
    refetchInterval: 8000,
    staleTime: 5000,
    enabled: !!repo && ready,
  });

  if (!state) return null;

  const parts: string[] = [];
  if (state.merging) parts.push(t("toolbar.merging"));
  if (state.rebasing) parts.push(t("toolbar.rebasing"));
  if (state.cherry_picking) parts.push(t("toolbar.cherryPicking"));
  if (state.reverting) parts.push(t("toolbar.reverting"));
  if (state.conflict_count > 0) {
    parts.push(t("toolbar.conflicts", { count: state.conflict_count }));
  }

  if (parts.length === 0) return null;

  return <Badge>{parts.join(" · ")}</Badge>;
}

function SyncStatusWidget() {
  const t = useT();
  const repo = useAppStore((s) => s.repo);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setReady(true), 5000);
    return () => window.clearTimeout(id);
  }, [repo?.path]);
  const { data: branches } = useBranches(!!repo && ready);
  if (!repo || !branches) return null;
  const current = branches.find((b) => b.is_current && !b.is_remote);
  if (!current || (current.ahead === 0 && current.behind === 0)) return null;
  return (
    <span
      className="jb-toolbar-sync"
      title={t("toolbar.syncStatus", { ahead: current.ahead, behind: current.behind })}
    >
      {current.ahead > 0 && <span className="jb-toolbar-sync-ahead">↑{current.ahead}</span>}
      {current.behind > 0 && <span className="jb-toolbar-sync-behind">↓{current.behind}</span>}
    </span>
  );
}

function RemoteSelector() {
  const repo = useAppStore((s) => s.repo);
  const selectedRemote = useAppStore((s) => s.selectedRemote);
  const setSelectedRemote = useAppStore((s) => s.setSelectedRemote);
  if (!repo || repo.remotes.length <= 1) return null;
  return (
    <Select
      className="jb-toolbar-remote-select"
      value={selectedRemote}
      onChange={(e) => setSelectedRemote(e.target.value)}
    >
      {repo.remotes.map((r) => (
        <option key={r.name} value={r.name}>
          {r.name}
        </option>
      ))}
    </Select>
  );
}

export function MainToolbar() {
  const t = useT();
  const repo = useAppStore((s) => s.repo);
  const selectedRemote = useAppStore((s) => s.selectedRemote);
  const appendVcsOutput = useAppStore((s) => s.appendVcsOutput);
  const clearVcsOutput = useAppStore((s) => s.clearVcsOutput);
  const openLogEditor = useAppStore((s) => s.openLogEditor);
  const openBranchesEditor = useAppStore((s) => s.openBranchesEditor);
  const openSettingsEditor = useAppStore((s) => s.openSettingsEditor);
  const setBottomToolWindow = useAppStore((s) => s.setBottomToolWindow);
  const resetWorkspace = useAppStore((s) => s.resetWorkspace);
  const invalidate = useInvalidateRepo();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<"fetch" | "pull" | "push" | "refresh" | null>(null);

  const refreshProject = useCallback(async () => {
    if (busy) return;
    setBusy("refresh");
    try {
      await refreshProjectTree(queryClient);
      await invalidate();
    } catch (e) {
      void uiAlert(String(e));
    } finally {
      setBusy(null);
    }
  }, [busy, invalidate, queryClient]);

  if (!repo) return null;

  const branch = repo.branch;

  async function runRemote(
    actionKey: "fetch" | "pull" | "push",
    label: string,
    action: () => Promise<{ output: string }>,
  ) {
    setBusy(actionKey);
    clearVcsOutput();
    setBottomToolWindow("vcsConsole");
    try {
      const result = await action();
      appendVcsOutput(result.output || t("common.actionCompleted", { action: label }));
      await invalidate();
      await queryClient.invalidateQueries({ queryKey: ["log"] });
    } catch (e) {
      appendVcsOutput(String(e));
    } finally {
      setBusy(null);
    }
  }

  async function closeRepo() {
    // Frontend belt-and-suspenders: close PTYs before workspace reset.
    // Backend close_repository also calls terminals.close_all().
    try {
      await api.terminalCloseAll();
    } catch {
      // ignore — closeRepository still reaps sessions
    }
    await api.closeRepository();
    resetWorkspace();
  }

  async function openRepoFolder() {
    if (!repo) return;
    try {
      await openPath(repo.path);
    } catch {
      try {
        await revealItemInDir(repo.path);
      } catch {
        // ignore: opener not available
      }
    }
  }

  return (
    <header className="jb-header flex items-center gap-1.5 px-2 py-1.5">
      <div className="jb-toolbar-group">
        <BranchDropdown />
        <GitOperationsActions />
      </div>
      <MergeRebaseWidget />

      <Button
        variant="toolbarIcon"
        title={t("projectToolbar.refresh")}
        disabled={!!busy}
        onClick={() => void refreshProject()}
      >
        <RefreshIcon />
        {busy === "refresh" ? "…" : null}
      </Button>
      <Button
        variant="toolbarRepo"
        className="min-w-0 max-w-xs"
        title={t("toolbar.openInFolder", { path: repo.path })}
        onClick={() => void openRepoFolder()}
      >
        <RepoIcon />
        <span className="truncate">{repoName(repo.path)}</span>
        <OpenFolderIcon />
      </Button>
      <SyncStatusWidget />
      <span className="flex-1" />

      <div className="jb-toolbar-group">
        <RemoteSelector />
        <Button
          variant="toolbar"
          disabled={!!busy}
          title={t("toolbar.fetch")}
          onClick={() => runRemote("fetch", t("toolbar.fetch"), () => api.gitFetch(selectedRemote))}
        >
          <FetchIcon />
          {busy === "fetch" ? "…" : t("toolbar.fetch")}
        </Button>
        <Button
          variant="toolbar"
          disabled={!!busy}
          title={t("toolbar.update")}
          onClick={() => runRemote("pull", t("toolbar.update"), () => api.gitPull(selectedRemote, branch))}
        >
          <PullIcon />
          {busy === "pull" ? "…" : t("toolbar.update")}
        </Button>
        <Button
          variant="toolbar"
          disabled={!!busy}
          title={t("toolbar.push")}
          onClick={() => runRemote("push", t("toolbar.push"), () => api.gitPush(selectedRemote, branch))}
        >
          <PushIcon />
          {busy === "push" ? "…" : t("toolbar.push")}
        </Button>
      </div>

      <span className="jb-toolbar-sep" />

      <div className="jb-toolbar-group">
        <Button variant="toolbar" onClick={() => openLogEditor()}>
          {t("toolbar.log")}
        </Button>
        <Button variant="toolbar" onClick={() => openBranchesEditor()}>
          {t("toolbar.branches")}
        </Button>
      </div>

      <span className="jb-toolbar-sep" />

      <div className="jb-toolbar-group">
        <Button variant="toolbarIcon" title={t("toolbar.settings")} onClick={() => openSettingsEditor()}>
          <SettingsIcon />
        </Button>
        <Button variant="toolbarIcon" title={t("toolbar.newWindow")} onClick={() => void api.openNewWindow()}>
          <NewWindowIcon />
        </Button>
        <Button variant="toolbarIcon" title={t("toolbar.closeRepo")} onClick={() => void closeRepo()}>
          <CloseRepoIcon />
        </Button>
      </div>
    </header>
  );
}
