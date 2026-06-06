import { useCallback } from "react";
import { api } from "../../lib/api";
import type { FileChange } from "../../lib/types";
import { useAppStore } from "../../store/appStore";
import { useStatus } from "../../hooks/useRepo";
import {
  ChangesFileList,
  useSelectedPaths,
} from "../ChangesFileList";
import { CommitPanel } from "../CommitPanel";
import { Button, Loading, ToolbarStrip } from "../ui";
import { useT } from "../../context/PreferencesContext";

export function LocalChangesTab() {
  const t = useT();
  const openDiffEditor = useAppStore((s) => s.openDiffEditor);
  const { data, refetch, isLoading } = useStatus(true);
  const { selected, selectedPaths, toggle, clear } = useSelectedPaths();

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
          onClick={() => runStage(() => api.discardChanges(selectedPaths))}
          disabled={selectedPaths.length === 0}
        >
          {t("commit.discard")}
        </Button>
      </ToolbarStrip>

      {isLoading && !data ? (
        <Loading />
      ) : (
        <ChangesFileList
          staged={data?.staged ?? []}
          unstaged={data?.unstaged ?? []}
          untracked={data?.untracked ?? []}
          selected={selected}
          onToggle={toggle}
          onOpen={openFile}
        />
      )}

      <div className="jb-border-t shrink-0">
        <CommitPanel onCommitted={onCommitted} />
      </div>
    </div>
  );
}
