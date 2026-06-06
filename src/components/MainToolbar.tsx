import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { openPath, revealItemInDir } from "@tauri-apps/plugin-opener";
import { api } from "../lib/api";
import { refreshProjectTree } from "../lib/projectTreeActions";
import { repoName } from "../lib/utils";
import { useAppStore } from "../store/appStore";
import { useInvalidateRepo } from "../hooks/useRepo";
import { BranchDropdown } from "./BranchDropdown";
import { GitOperationsActions } from "./GitOperationsActions";
import { Badge, Button } from "./ui";
import { useT } from "../context/PreferencesContext";

const ICON = "0 0 16 16";

function FetchIcon() {
  return (
    <svg viewBox={ICON} aria-hidden>
      <path
        fill="currentColor"
        d="M8 2a6 6 0 0 1 5.66 4h-1.6A4.5 4.5 0 0 0 3.5 8H5L2.75 10.75 0.5 8H2a6 6 0 0 1 6-6Zm5.25 5.25L15.5 10 13.25 7.25 13.25 7.25Zm.25 0.75H12a4.5 4.5 0 0 1-8.56 2h1.6A3 3 0 0 0 12 8h1.5Z"
      />
    </svg>
  );
}

function PullIcon() {
  return (
    <svg viewBox={ICON} aria-hidden>
      <path
        fill="currentColor"
        d="M7.25 2v6.19L5.03 5.97l-1.06 1.06L8 11.06l4.03-4.03-1.06-1.06-2.22 2.22V2h-1.5ZM3 12.5h10V14H3v-1.5Z"
      />
    </svg>
  );
}

function PushIcon() {
  return (
    <svg viewBox={ICON} aria-hidden>
      <path
        fill="currentColor"
        d="M8 4.94 5.78 7.16 4.72 6.1 8 2.82l3.28 3.28-1.06 1.06L8 4.94v6.19h-1.5V4.94H8Zm-.75 0H8v6.19h-.75V4.94ZM3 12.5h10V14H3v-1.5Z"
      />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg viewBox={ICON} aria-hidden>
      <path
        fill="currentColor"
        d="M8 5.25a2.75 2.75 0 1 0 0 5.5 2.75 2.75 0 0 0 0-5.5Zm0 1.5a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5Zm-1-5h2l.3 1.55c.4.13.78.31 1.13.54l1.46-.6 1 1.73-1.16 1.05c.05.21.07.43.07.65s-.02.44-.07.65l1.16 1.05-1 1.73-1.46-.6c-.35.23-.73.4-1.13.54L9 14.25H7l-.3-1.55a4.6 4.6 0 0 1-1.13-.54l-1.46.6-1-1.73 1.16-1.05A3.4 3.4 0 0 1 4.2 8c0-.22.02-.44.07-.65L3.11 6.3l1-1.73 1.46.6c.35-.23.73-.41 1.13-.54L7 1.75Z"
      />
    </svg>
  );
}

function NewWindowIcon() {
  return (
    <svg viewBox={ICON} aria-hidden>
      <path
        fill="currentColor"
        d="M2.5 3.5A1.5 1.5 0 0 1 4 2h5v1.5H4v8h8V7h1.5v4.5A1.5 1.5 0 0 1 12 13H4a1.5 1.5 0 0 1-1.5-1.5v-8Zm9 .5V2H13v3.5h-1.5V4.56L8.53 7.53 7.47 6.47 10.44 3.5H9.5V2H13v.001Z"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox={ICON} aria-hidden>
      <path
        fill="currentColor"
        d="M9.5 2A1.5 1.5 0 0 1 11 3.5V5H9.5V3.5h-6v9h6V11H11v1.5A1.5 1.5 0 0 1 9.5 14h-6A1.5 1.5 0 0 1 2 12.5v-9A1.5 1.5 0 0 1 3.5 2h6Zm2.22 3.97L14.25 8.5l-2.53 2.53-1.06-1.06 1.22-1.22H6.5v-1.5h5.38l-1.22-1.22 1.06-1.06Z"
      />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg viewBox={ICON} aria-hidden>
      <path
        fill="currentColor"
        d="M8 2.5a5.5 5.5 0 0 1 5.5 5.5H12a4 4 0 0 0-7.5 2.2L3.5 8.5 2 7l2.5-2.2A5.5 5.5 0 0 1 8 2.5Zm0 11a4.5 4.5 0 0 0 4.5-3.7H11a3 3 0 0 1-5.5-1.3l1.25 1.2L5 11.5l1.5 1.5 1.25-1.2A4.5 4.5 0 0 0 8 13.5Z"
      />
    </svg>
  );
}

function RepoIcon() {
  return (
    <svg viewBox={ICON} aria-hidden>
      <path
        fill="currentColor"
        d="M2 4.5A1.5 1.5 0 0 1 3.5 3H6l1.2 1.2h5.3A1.5 1.5 0 0 1 14 5.7v6.8A1.5 1.5 0 0 1 12.5 14h-9A1.5 1.5 0 0 1 2 12.5v-8Z"
      />
    </svg>
  );
}

function OpenFolderIcon() {
  return (
    <svg viewBox={ICON} aria-hidden className="jb-toolbar-repo-open">
      <path
        fill="currentColor"
        d="M6 3.5h6.5v6.5h-1.5V6.06L6.53 10.53 5.47 9.47 9.94 5H6V3.5Z"
      />
    </svg>
  );
}

function MergeRebaseWidget() {
  const t = useT();
  const { data: state } = useQuery({
    queryKey: ["repo-operation-state"],
    queryFn: api.getRepoOperationState,
    refetchInterval: 3000,
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

export function MainToolbar() {
  const t = useT();
  const repo = useAppStore((s) => s.repo);
  const selectedRemote = useAppStore((s) => s.selectedRemote);
  const appendVcsOutput = useAppStore((s) => s.appendVcsOutput);
  const clearVcsOutput = useAppStore((s) => s.clearVcsOutput);
  const openLogEditor = useAppStore((s) => s.openLogEditor);
  const openBranchesEditor = useAppStore((s) => s.openBranchesEditor);
  const openSettingsEditor = useAppStore((s) => s.openSettingsEditor);
  const setLeftToolWindow = useAppStore((s) => s.setLeftToolWindow);
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
      window.alert(String(e));
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
    try {
      const result = await action();
      appendVcsOutput(result.output || t("common.actionCompleted", { action: label }));
      await invalidate();
      await queryClient.invalidateQueries({ queryKey: ["log"] });
      await queryClient.invalidateQueries({ queryKey: ["branches"] });
      await queryClient.invalidateQueries({ queryKey: ["repo-operation-state"] });
    } catch (e) {
      appendVcsOutput(String(e));
    } finally {
      setBusy(null);
    }
  }

  async function closeRepo() {
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
      <button
        type="button"
        className="jb-toolbar-repo min-w-0 max-w-xs"
        title={t("toolbar.openInFolder", { path: repo.path })}
        onClick={() => void openRepoFolder()}
      >
        <RepoIcon />
        <span className="truncate">{repoName(repo.path)}</span>
        <OpenFolderIcon />
      </button>
      <span className="flex-1" />

      <div className="jb-toolbar-group">
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
        <Button variant="toolbar" onClick={() => setLeftToolWindow("pullRequests")}>
          {t("toolbar.prs")}
        </Button>
        <Button variant="toolbar" onClick={() => setLeftToolWindow("mergeRequests")}>
          {t("toolbar.mrs")}
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
          <CloseIcon />
        </Button>
      </div>
    </header>
  );
}
