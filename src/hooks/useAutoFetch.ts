import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { invalidateGitState } from "../lib/queryInvalidation";
import { useAppStore } from "../store/appStore";
import { useSettings } from "./useRepo";

/**
 * Periodically `git fetch` the selected remote while a repository is open.
 * `auto_fetch_minutes === 0` disables the timer.
 */
export function useAutoFetch() {
  const queryClient = useQueryClient();
  const { data: settings } = useSettings();
  const repo = useAppStore((s) => s.repo);
  const selectedRemote = useAppStore((s) => s.selectedRemote);
  const appendVcsOutput = useAppStore((s) => s.appendVcsOutput);
  const minutes = settings?.auto_fetch_minutes ?? 0;
  const inFlight = useRef(false);

  useEffect(() => {
    if (!repo || minutes <= 0) return;

    const intervalMs = Math.max(1, minutes) * 60_000;

    const tick = () => {
      if (inFlight.current) return;
      inFlight.current = true;
      void api
        .gitFetch(selectedRemote)
        .then(async (result) => {
          if (result.output?.trim()) {
            appendVcsOutput(result.output.trimEnd());
          }
          await invalidateGitState(queryClient);
        })
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : String(error);
          appendVcsOutput(`auto-fetch failed: ${message}`);
        })
        .finally(() => {
          inFlight.current = false;
        });
    };

    const id = window.setInterval(tick, intervalMs);
    return () => {
      window.clearInterval(id);
      inFlight.current = false;
    };
  }, [appendVcsOutput, minutes, queryClient, repo, selectedRemote]);
}
