import type { FileDiff, FilePreview } from "./types";
import { langFromPath } from "./highlight";

export function fileDiffToPreview(diff: FileDiff): FilePreview {
  return {
    path: diff.path,
    kind: diff.is_binary ? "binary" : "text_diff",
    mime: "",
    language: langFromPath(diff.path),
    diff: diff.is_binary ? null : diff,
    content: null,
    data_base64: null,
    size_bytes: 0,
    absolute_path: null,
  };
}

export async function openBranchCompareDiff(
  baseBranch: string,
  headBranch: string,
  openDiffEditor: (diff: import("./types").DiffTab) => void,
) {
  const { api } = await import("./api");
  const files = await api.getBranchDiffFiles(baseBranch, headBranch);
  if (files.length === 0) {
    throw new Error(`No differences between '${baseBranch}' and '${headBranch}'`);
  }
  openDiffEditor({
    id: `branch:${baseBranch}:${headBranch}:${files[0]}`,
    path: files[0],
    mode: "branch",
    baseBranch,
    headBranch,
  });
}

export async function openBranchWorkingDiff(
  branch: string,
  openDiffEditor: (diff: import("./types").DiffTab) => void,
) {
  const { api } = await import("./api");
  const files = await api.getBranchWorkingDiffFiles(branch);
  if (files.length === 0) {
    throw new Error(`No differences between '${branch}' and working tree`);
  }
  openDiffEditor({
    id: `branch-wt:${branch}:${files[0]}`,
    path: files[0],
    mode: "branch_working",
    headBranch: branch,
  });
}
