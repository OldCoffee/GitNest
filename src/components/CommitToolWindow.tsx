import { useAppStore } from "../store/appStore";
import type { CommitTwTab } from "../lib/types";
import { sameWorkspacePath } from "../lib/workspaceRoots";
import { repoName } from "../lib/utils";
import { ConflictsTab } from "./commit/ConflictsTab";
import { LocalChangesTab } from "./commit/LocalChangesTab";
import { StagingAreaTab } from "./commit/StagingAreaTab";
import { StashTab } from "./commit/StashTab";
import { WorktreesTab } from "./commit/WorktreesTab";
import { Tabs, ToolWindowShell, type TabItem } from "./ui";
import { useT } from "../context/PreferencesContext";

export function CommitToolWindow() {
  const t = useT();
  const commitTwTab = useAppStore((s) => s.commitTwTab);
  const setCommitTwTab = useAppStore((s) => s.setCommitTwTab);
  const activeGitRoot = useAppStore((s) => s.activeGitRoot);
  const commitRepoPath = useAppStore((s) => s.commitRepoPath ?? s.activeGitRoot);
  const focusedOtherRoot =
    !!commitRepoPath &&
    !!activeGitRoot &&
    !sameWorkspacePath(commitRepoPath, activeGitRoot);

  const TABS: ReadonlyArray<TabItem<CommitTwTab>> = [
    { id: "local", label: t("commit.localChanges") },
    { id: "staging", label: t("commit.stagingArea") },
    { id: "stash", label: t("commit.stash") },
    { id: "conflicts", label: t("commit.conflicts") },
    { id: "worktrees", label: t("commit.worktrees") },
  ];

  const title = focusedOtherRoot
    ? `${t("sidebar.git")} · ${repoName(commitRepoPath)}`
    : t("sidebar.git");

  return (
    <ToolWindowShell
      title={title}
      tabs={<Tabs tabs={TABS} value={commitTwTab} onChange={setCommitTwTab} variant="tool" />}
      bodyClassName="overflow-hidden p-0"
    >
      {commitTwTab === "local" && <LocalChangesTab />}
      {commitTwTab === "staging" && <StagingAreaTab />}
      {commitTwTab === "stash" && <StashTab />}
      {commitTwTab === "conflicts" && <ConflictsTab />}
      {commitTwTab === "worktrees" && <WorktreesTab />}
    </ToolWindowShell>
  );
}
