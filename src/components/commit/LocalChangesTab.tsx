import { useCallback, useState } from "react";
import { api } from "../../lib/api";
import type { FileChange } from "../../lib/types";
import { useAppStore } from "../../store/appStore";
import { useStatus } from "../../hooks/useRepo";
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
  const { data, refetch, isLoading } = useStatus(true);
  const { selected, selectedPaths, toggle, toggleRange, setMany, clear } = useSelectedPaths();
  const [confirmDiscard, setConfirmDiscard] = useState(false);

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
          onClick={() =>
            runStage(() =>
              selectedPaths.length
                ? api.stageFiles(selectedPaths)
                : api.stageAllFiles(),
            )
          }
        >
          {t("commit.stage")}
        </Button>
        <Button
          onClick={() =>
            runStage(() =>
              selectedPaths.length
                ? api.unstageFiles(selectedPaths)
                : api.unstageAllFiles(),
            )
          }
        >
          {t("commit.unstage")}
        </Button>
        <Button
          onClick={() => setConfirmDiscard(true)}
          disabled={selectedPaths.length === 0}
        >
          {t("commit.discard")}
        </Button>
      </ToolbarStrip>

      {confirmDiscard && (
        <ConfirmDialog
          title={t("commit.discardTitle")}
          message={t("commit.discardMessage", { count: selectedPaths.length })}
          confirmLabel={t("commit.discard")}
          danger
          onCancel={() => setConfirmDiscard(false)}
          onConfirm={() => {
            setConfirmDiscard(false);
            void runStage(() => api.discardChanges(selectedPaths));
          }}
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
