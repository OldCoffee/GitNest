import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "../lib/api";
import { useAppStore } from "../store/appStore";
import { useInvalidateRepo } from "../hooks/useRepo";
import { useT } from "../context/PreferencesContext";

export function GitOperationsActions() {
  const t = useT();
  const appendVcsOutput = useAppStore((s) => s.appendVcsOutput);
  const setBottomToolWindow = useAppStore((s) => s.setBottomToolWindow);
  const setCommitTwTab = useAppStore((s) => s.setCommitTwTab);
  const invalidate = useInvalidateRepo();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);

  const { data: opState } = useQuery({
    queryKey: ["repo-operation-state"],
    queryFn: api.getRepoOperationState,
    refetchInterval: 2000,
  });

  async function run(label: string, action: () => Promise<{ output: string }>) {
    setBusy(true);
    setBottomToolWindow("vcsConsole");
    try {
      const result = await action();
      appendVcsOutput(result.output || t("common.actionCompleted", { action: label }));
      await invalidate();
      await queryClient.invalidateQueries({ queryKey: ["repo-operation-state"] });
      await queryClient.invalidateQueries({ queryKey: ["log"] });
      if (opState?.conflict_count) {
        setCommitTwTab("conflicts");
      }
    } catch (e) {
      appendVcsOutput(String(e));
    } finally {
      setBusy(false);
    }
  }

  const inOperation =
    opState?.merging || opState?.rebasing || opState?.cherry_picking || opState?.reverting;

  if (!inOperation) return null;

  return (
    <div className="flex items-center gap-1">
      {opState?.rebasing && (
        <>
          <button
            type="button"
            className="jb-toolbar-btn text-xs"
            disabled={busy}
            onClick={() => void run(t("gitOps.continueRebase"), api.gitRebaseContinue)}
          >
            {t("gitOps.continue")}
          </button>
          <button
            type="button"
            className="jb-toolbar-btn text-xs"
            disabled={busy}
            onClick={() => void run(t("gitOps.skipRebase"), api.gitRebaseSkip)}
          >
            {t("gitOps.skip")}
          </button>
          <button
            type="button"
            className="jb-toolbar-btn text-xs"
            disabled={busy}
            onClick={() => void run(t("gitOps.abortRebaseAction"), api.gitRebaseAbort)}
          >
            {t("gitOps.abortRebase")}
          </button>
        </>
      )}
      {opState?.merging && (
        <button
          type="button"
          className="jb-toolbar-btn text-xs"
          disabled={busy}
          onClick={() => void run(t("gitOps.abortMergeAction"), api.gitMergeAbort)}
        >
          {t("gitOps.abortMerge")}
        </button>
      )}
      {opState?.cherry_picking && (
        <button
          type="button"
          className="jb-toolbar-btn text-xs"
          disabled={busy}
          onClick={() => void run(t("gitOps.abortCherryPickAction"), api.gitCherryPickAbort)}
        >
          {t("gitOps.abortCherryPick")}
        </button>
      )}
    </div>
  );
}
