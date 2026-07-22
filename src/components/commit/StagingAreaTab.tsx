import { useCallback } from "react";
import { api } from "../../lib/api";
import type { FileChange } from "../../lib/types";
import { useAppStore } from "../../store/appStore";
import { useCommitRepoPath, useStatus } from "../../hooks/useRepo";
import { ChangesFileList, useSelectedPaths } from "../ChangesFileList";
import { useT } from "../../context/PreferencesContext";
import { Button, Loading, ToolbarStrip } from "../ui";

export function StagingAreaTab() {
  const t = useT();
  const openDiffEditor = useAppStore((s) => s.openDiffEditor);
  const commitRepoPath = useCommitRepoPath();
  const { data, refetch, isLoading } = useStatus(true);
  const { selected, toggle, toggleRange, setMany } = useSelectedPaths();

  const openFile = useCallback(
    (file: FileChange, mode: "working" | "staged") => {
      openDiffEditor({ path: file.path, mode, id: `${mode}:${file.path}` });
    },
    [openDiffEditor],
  );

  async function runStage(stageFn: () => Promise<void>) {
    await stageFn();
    await refetch();
  }

  if (isLoading && !data) {
    return <Loading />;
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ToolbarStrip>
        <Button onClick={() => runStage(() => api.stageAllFiles(commitRepoPath))}>
          {t("commit.stageAll")}
        </Button>
        <Button onClick={() => runStage(() => api.unstageAllFiles(commitRepoPath))}>
          {t("commit.unstageAll")}
        </Button>
      </ToolbarStrip>
      <ChangesFileList
        staged={data?.staged ?? []}
        unstaged={[...(data?.unstaged ?? []), ...(data?.untracked ?? [])]}
        untracked={[]}
        conflicted={data?.conflicted}
        selected={selected}
        onToggle={toggle}
        onToggleRange={toggleRange}
        onSetMany={setMany}
        onOpen={openFile}
      />
    </div>
  );
}
