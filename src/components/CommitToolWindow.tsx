import { useAppStore } from "../store/appStore";
import type { CommitTwTab } from "../lib/types";
import { ConflictsTab } from "./commit/ConflictsTab";
import { LocalChangesTab } from "./commit/LocalChangesTab";
import { StagingAreaTab } from "./commit/StagingAreaTab";
import { StashTab } from "./commit/StashTab";
import { WorktreesTab } from "./commit/WorktreesTab";
import { Panel, Tabs, type TabItem } from "./ui";
import { useT } from "../context/PreferencesContext";

export function CommitToolWindow() {
  const t = useT();
  const commitTwTab = useAppStore((s) => s.commitTwTab);
  const setCommitTwTab = useAppStore((s) => s.setCommitTwTab);

  const TABS: ReadonlyArray<TabItem<CommitTwTab>> = [
    { id: "local", label: t("commit.localChanges") },
    { id: "staging", label: t("commit.stagingArea") },
    { id: "stash", label: t("commit.stash") },
    { id: "conflicts", label: t("commit.conflicts") },
    { id: "worktrees", label: t("commit.worktrees") },
  ];

  return (
    <Panel>
      <Tabs tabs={TABS} value={commitTwTab} onChange={setCommitTwTab} />
      <div className="min-h-0 flex-1 overflow-hidden">
        {commitTwTab === "local" && <LocalChangesTab />}
        {commitTwTab === "staging" && <StagingAreaTab />}
        {commitTwTab === "stash" && <StashTab />}
        {commitTwTab === "conflicts" && <ConflictsTab />}
        {commitTwTab === "worktrees" && <WorktreesTab />}
      </div>
    </Panel>
  );
}
