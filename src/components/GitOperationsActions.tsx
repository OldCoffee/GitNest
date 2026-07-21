import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "../lib/api";
import { useAppStore } from "../store/appStore";
import { useInvalidateRepo } from "../hooks/useRepo";
import { useT } from "../context/PreferencesContext";
import { Button } from "./ui";

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
    staleTime: 5000,
    // Only poll while a long-running git op is active — otherwise reuse cache.
    refetchInterval: (query) => {
      const state = query.state.data;
      if (!state) return false;
      if (
        state.merging ||
        state.rebasing ||
        state.cherry_picking ||
        state.reverting ||
        (state.conflict_count ?? 0) > 0
      ) {
        return 3000;
      }
      return false;
    },
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
          <Button
            variant="toolbar"
            size="sm"
            disabled={busy}
            onClick={() => void run(t("gitOps.continueRebase"), api.gitRebaseContinue)}
          >
            {t("gitOps.continue")}
          </Button>
          <Button
            variant="toolbar"
            size="sm"
            disabled={busy}
            onClick={() => void run(t("gitOps.skipRebase"), api.gitRebaseSkip)}
          >
            {t("gitOps.skip")}
          </Button>
          <Button
            variant="toolbar"
            size="sm"
            disabled={busy}
            onClick={() => void run(t("gitOps.abortRebaseAction"), api.gitRebaseAbort)}
          >
            {t("gitOps.abortRebase")}
          </Button>
        </>
      )}
      {opState?.merging && (
        <Button
          variant="toolbar"
          size="sm"
          disabled={busy}
          onClick={() => void run(t("gitOps.abortMergeAction"), api.gitMergeAbort)}
        >
          {t("gitOps.abortMerge")}
        </Button>
      )}
      {opState?.cherry_picking && (
        <Button
          variant="toolbar"
          size="sm"
          disabled={busy}
          onClick={() => void run(t("gitOps.abortCherryPickAction"), api.gitCherryPickAbort)}
        >
          {t("gitOps.abortCherryPick")}
        </Button>
      )}
    </div>
  );
}
