import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { fileDiffToPreview } from "../lib/branchDiff";
import type { DiffTab } from "../lib/types";
import { useSettings } from "../hooks/useRepo";
import { useAppStore } from "../store/appStore";
import { useT } from "../context/PreferencesContext";
import { FilePreviewView } from "./FilePreviewView";
import { InlineAlert, Loading } from "./ui";

interface DiffViewerProps {
  tab: DiffTab;
}

export function DiffViewer({ tab }: DiffViewerProps) {
  const t = useT();
  const activeGitRoot = useAppStore((s) => s.activeGitRoot);
  const { data: settings } = useSettings();
  const diffMode = settings?.diff_mode ?? "unified";
  const isBranchDiff = tab.mode === "branch" || tab.mode === "branch_working";
  const previewMode =
    tab.mode === "commit" ? "commit" : tab.mode === "staged" ? "staged" : "working";

  const previewQuery = useQuery({
    queryKey: ["preview", activeGitRoot, tab.id, tab.path, tab.mode, tab.commitHash],
    queryFn: () =>
      api.getFilePreview(tab.path, previewMode, tab.commitHash ?? null, activeGitRoot),
    enabled: !isBranchDiff,
  });

  const branchDiffQuery = useQuery({
    queryKey: [
      "branch-diff",
      activeGitRoot,
      tab.id,
      tab.baseBranch,
      tab.headBranch,
      tab.path,
      tab.mode,
    ],
    queryFn: async () => {
      if (tab.mode === "branch" && tab.baseBranch && tab.headBranch) {
        const diff = await api.getDiffBranchRange(
          tab.baseBranch,
          tab.headBranch,
          tab.path,
          activeGitRoot,
        );
        return fileDiffToPreview(diff);
      }
      if (tab.mode === "branch_working" && tab.headBranch) {
        const diff = await api.getDiffBranchWorking(
          tab.headBranch,
          tab.path,
          activeGitRoot,
        );
        return fileDiffToPreview(diff);
      }
      throw new Error(t("preview.invalidBranchDiff"));
    },
    enabled: isBranchDiff,
  });

  const { data: preview, isLoading, error } = isBranchDiff ? branchDiffQuery : previewQuery;

  if (isLoading) {
    return <Loading className="p-4">{t("preview.loadingPreview")}</Loading>;
  }
  if (error) {
    return (
      <InlineAlert level="error" className="m-4">
        {String(error)}
      </InlineAlert>
    );
  }
  if (!preview) return null;

  return <FilePreviewView preview={preview} diffMode={diffMode} tab={tab} />;
}
