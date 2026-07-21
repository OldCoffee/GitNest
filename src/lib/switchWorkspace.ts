import type { QueryClient } from "@tanstack/react-query";
import { javaLspClient } from "../editor/lspClient";
import { api } from "./api";
import { prepareWorkspace } from "./prepareWorkspace";
import type { RepoInfo } from "./types";
import { confirmDiscardUnsaved } from "./unsavedGuard";

export type SwitchWorkspaceLabels = {
  unsavedTitle: string;
  unsavedMessage: (count: number) => string;
  unsavedConfirm: string;
};

/**
 * Switch the single open repository in-place: confirm dirty buffers, tear down
 * terminals/LSP/backend handle, then open and warm queries for the new path.
 * Does not flash WelcomePage (never sets repo to null).
 */
export async function switchWorkspace(
  path: string,
  queryClient: QueryClient,
  setRepo: (info: RepoInfo) => void,
  labels: SwitchWorkspaceLabels,
): Promise<boolean> {
  const ok = await confirmDiscardUnsaved({
    title: labels.unsavedTitle,
    message: labels.unsavedMessage,
    confirmLabel: labels.unsavedConfirm,
  });
  if (!ok) return false;

  try {
    await api.terminalCloseAll();
  } catch {
    // backend close still reaps sessions
  }
  try {
    await javaLspClient.stop();
  } catch {
    // ignore
  }

  await api.closeRepository();
  queryClient.clear();

  const info = await prepareWorkspace(path, queryClient);
  setRepo(info);
  return true;
}
