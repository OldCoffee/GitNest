import { useCallback } from "react";
import { api } from "../../lib/api";
import type { FileChange } from "../../lib/types";
import { useAppStore } from "../../store/appStore";
import { useCommitRepoPath, useStatus } from "../../hooks/useRepo";
import { useDiscardConfirm } from "../../hooks/useDiscardConfirm";
import {
  ChangesFileList,
  useSelectedPaths,
} from "../ChangesFileList";
import { CommitPanel } from "../CommitPanel";
import { Button, ConfirmDialog, Loading, ToolbarStrip } from "../ui";
import { useT } from "../../context/PreferencesContext";

export function LocalChangesTab() {
  const t = useT();
  const openDiffEditor = useAppStore((s) => s.openDiffEditor);
  const commitRepoPath = useCommitRepoPath();
  const { data, refetch, isLoading } = useStatus(true);
  const { selected, selectedPaths, toggle, toggleRange, setMany, clear } = useSelectedPaths();
  const { pending, requestDiscard, cancel, confirm } = useDiscardConfirm();

  const openFile = useCallback(
    (file: FileChange, mode: "working" | "staged") => {
      openDiffEditor({ path: file.path, mode, id: `${mode}:${file.path}` });
    },
    [openDiffEditor],
  );

  async function runStage(stageFn: () => Promise<void>) {
    await stageFn();
    await refetch();
    clear();
  }

  const onCommitted = useCallback(() => {
    void refetch();
  }, [refetch]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ToolbarStrip>
        <Button
          data-testid="stage-button"
          onClick={() =>
            runStage(() =>
              selectedPaths.length
                ? api.stageFiles(selectedPaths, commitRepoPath)
                : api.stageAllFiles(commitRepoPath),
            )
          }
        >
          {t("commit.stage")}
        </Button>
        <Button
          onClick={() =>
            runStage(() =>
              selectedPaths.length
                ? api.unstageFiles(selectedPaths, commitRepoPath)
                : api.unstageAllFiles(commitRepoPath),
            )
          }
        >
          {t("commit.unstage")}
        </Button>
        <Button
          onClick={() =>
            requestDiscard(
              t("commit.discardMessage", { count: selectedPaths.length }),
              () => runStage(() => api.discardChanges(selectedPaths, commitRepoPath)),
            )
          }
          disabled={selectedPaths.length === 0}
        >
          {t("commit.discard")}
        </Button>
      </ToolbarStrip>

      {pending && (
        <ConfirmDialog
          title={t("commit.discardTitle")}
          message={pending.message}
          confirmLabel={t("commit.discard")}
          danger
          onCancel={cancel}
          onConfirm={confirm}
        />
      )}

      {isLoading && !data ? (
        <Loading />
      ) : (
        <ChangesFileList
          staged={data?.staged ?? []}
          unstaged={data?.unstaged ?? []}
          untracked={data?.untracked ?? []}
          selected={selected}
          onToggle={toggle}
          onToggleRange={toggleRange}
          onSetMany={setMany}
          onOpen={openFile}
        />
      )}

      <div className="jb-commit-footer shrink-0">
        <CommitPanel onCommitted={onCommitted} />
      </div>
    </div>
  );
}
