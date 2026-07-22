import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { api } from "../../lib/api";
import type { FileChange } from "../../lib/types";
import { useAppStore } from "../../store/appStore";
import { useStatus } from "../../hooks/useRepo";
import { ChangesFileList, useSelectedPaths } from "../ChangesFileList";
import { useT } from "../../context/PreferencesContext";
import { Button, EmptyState, Loading } from "../ui";
import { invalidateGitState } from "../../lib/queryInvalidation";

export function ConflictsTab() {
  const t = useT();
  const openDiffEditor = useAppStore((s) => s.openDiffEditor);
  const appendVcsOutput = useAppStore((s) => s.appendVcsOutput);
  const conflictRepoPath = useAppStore((s) => s.commitRepoPath ?? s.activeGitRoot);
  const { data, refetch, isLoading } = useStatus(true);
  const { selected, toggle } = useSelectedPaths();
  const queryClient = useQueryClient();

  const conflicted = data?.conflicted ?? [];

  const openFile = useCallback(
    (file: FileChange, mode: "working" | "staged") => {
      openDiffEditor({ path: file.path, mode, id: `${mode}:${file.path}` });
    },
    [openDiffEditor],
  );

  async function resolve(path: string, side: "ours" | "theirs") {
    try {
      if (side === "ours") {
        await api.resolveConflictOurs(path, conflictRepoPath);
      } else {
        await api.resolveConflictTheirs(path, conflictRepoPath);
      }
      appendVcsOutput(t("commit.resolved", { path, side }));
      await refetch();
      await invalidateGitState(queryClient);
    } catch (e) {
      appendVcsOutput(String(e));
    }
  }

  if (isLoading && !data) {
    return <Loading />;
  }

  if (conflicted.length === 0) {
    return <EmptyState>{t("commit.noConflicts")}</EmptyState>;
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ChangesFileList
        staged={[]}
        unstaged={[]}
        untracked={[]}
        conflicted={conflicted}
        selected={selected}
        onToggle={toggle}
        onOpen={openFile}
        renderActions={(file) => (
          <>
            <Button className="shrink-0" onClick={() => void resolve(file.path, "ours")}>
              {t("commit.ours")}
            </Button>
            <Button className="shrink-0" onClick={() => void resolve(file.path, "theirs")}>
              {t("commit.theirs")}
            </Button>
          </>
        )}
      />
    </div>
  );
}
