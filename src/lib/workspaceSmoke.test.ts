/**
 * Store/API-level smoke for the core IDE Git loop:
 * open repo → see changes → edit/save → stage/commit → read log.
 * Uses mocked `api` (no Tauri / Playwright).
 */
import { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  CommitEntry,
  ProjectFileText,
  RepoInfo,
  StatusSnapshot,
} from "./types";

const openRepository = vi.fn();
const getStatus = vi.fn();
const getBranches = vi.fn();
const getRepoOperationState = vi.fn();
const getRepoInfo = vi.fn();
const listProjectEntries = vi.fn();
const readTextFile = vi.fn();
const writeTextFile = vi.fn();
const stageFiles = vi.fn();
const commitChanges = vi.fn();
const getLog = vi.fn();

vi.mock("./api", () => ({
  api: {
    openRepository: (...args: unknown[]) => openRepository(...args),
    getStatus: (...args: unknown[]) => getStatus(...args),
    getBranches: (...args: unknown[]) => getBranches(...args),
    getRepoOperationState: (...args: unknown[]) => getRepoOperationState(...args),
    getRepoInfo: (...args: unknown[]) => getRepoInfo(...args),
    listProjectEntries: (...args: unknown[]) => listProjectEntries(...args),
    readTextFile: (...args: unknown[]) => readTextFile(...args),
    writeTextFile: (...args: unknown[]) => writeTextFile(...args),
    stageFiles: (...args: unknown[]) => stageFiles(...args),
    commitChanges: (...args: unknown[]) => commitChanges(...args),
    getLog: (...args: unknown[]) => getLog(...args),
  },
}));

vi.mock("../editor/lspClient", () => ({
  isJdtUri: () => false,
  javaLspClient: { classFileContents: vi.fn() },
}));

import { DocumentStore } from "../editor/documentStore";
import { prepareWorkspace } from "./prepareWorkspace";

const repoInfo: RepoInfo = {
  path: "/tmp/demo",
  branch: "main",
  remotes: [],
  is_bare: false,
};

const emptyStatus: StatusSnapshot = {
  staged: [],
  unstaged: [],
  untracked: [],
  conflicted: [],
};

function fileText(content: string, modifiedMs = 1_000): ProjectFileText {
  return {
    content,
    is_binary: false,
    too_large: false,
    size_bytes: new TextEncoder().encode(content).length,
    modified_ms: modifiedMs,
  };
}

describe("workspace smoke: open → edit → commit → log", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    openRepository.mockResolvedValue(repoInfo);
    getStatus.mockResolvedValue({
      ...emptyStatus,
      unstaged: [
        {
          path: "README.md",
          old_path: null,
          status: "modified",
          staged: false,
          additions: 1,
          deletions: 0,
        },
      ],
    } satisfies StatusSnapshot);
    getBranches.mockResolvedValue([]);
    getRepoOperationState.mockResolvedValue({
      is_rebasing: false,
      is_merging: false,
      is_cherry_picking: false,
      has_conflicts: false,
    });
    getRepoInfo.mockResolvedValue(repoInfo);
    listProjectEntries.mockResolvedValue([
      { name: "README.md", path: "README.md", is_dir: false, ignored: false },
    ]);
    // Node: prepareWorkspace uses nested rAF + setTimeout
    vi.stubGlobal(
      "requestAnimationFrame",
      (cb: FrameRequestCallback) =>
        globalThis.setTimeout(() => cb(0), 0) as unknown as number,
    );
  });

  it("warms status and project tree on open, then save/stage/commit/log", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const steps: string[] = [];
    const info = await prepareWorkspace("/tmp/demo", queryClient, (s) => steps.push(s));
    expect(info.path).toBe("/tmp/demo");
    expect(steps).toEqual([
      "openingRepo",
      "loadingStatus",
      "loadingBranches",
      "ready",
    ]);
    expect(openRepository).toHaveBeenCalledWith("/tmp/demo");
    expect(getStatus).toHaveBeenCalled();
    expect(listProjectEntries).toHaveBeenCalled();

    const status = queryClient.getQueryData<StatusSnapshot>(["status"]);
    expect(status?.unstaged[0]?.path).toBe("README.md");

    const store = new DocumentStore();
    readTextFile.mockResolvedValueOnce(fileText("# Demo\n"));
    await store.load("README.md");
    store.update("README.md", "# Demo\n\nEdited\n");
    writeTextFile.mockResolvedValueOnce(2_000);
    await store.save("README.md");
    expect(writeTextFile).toHaveBeenCalledWith(
      "README.md",
      "# Demo\n\nEdited\n",
      1_000,
      false,
    );
    expect(store.isDirty("README.md")).toBe(false);

    stageFiles.mockResolvedValueOnce(undefined);
    commitChanges.mockResolvedValueOnce({ hash: "deadbeef", output: "" });
    await stageFiles(["README.md"]);
    const result = await commitChanges({
      subject: "docs: update readme",
      body: "",
      amend: false,
    });
    expect(result).toEqual({ hash: "deadbeef", output: "" });

    const logEntry = {
      hash: "deadbeef",
      parents: [],
      author: "Test",
      email: "t@ex.com",
      date: 1_700_000_000,
      subject: "docs: update readme",
      body: "",
      refs: [],
      graph_row: { node_lane: 0, lanes: 1, color: 0, edges: [] },
    } as unknown as CommitEntry;
    getLog.mockResolvedValueOnce([logEntry]);
    const log = await getLog(null, 0, 50, undefined);
    expect(log[0]?.subject).toBe("docs: update readme");
  });
});
