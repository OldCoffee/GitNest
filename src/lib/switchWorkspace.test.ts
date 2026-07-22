import { beforeEach, describe, expect, it, vi } from "vitest";
import type { QueryClient } from "@tanstack/react-query";

const closeRepository = vi.fn();
const terminalCloseAll = vi.fn();
const openRepository = vi.fn();
const getStatus = vi.fn();
const getBranches = vi.fn();
const getRepoOperationState = vi.fn();
const getRepoInfo = vi.fn();
const listProjectEntries = vi.fn();
const listWorkspaceRoots = vi.fn();
const addWorkspaceFolder = vi.fn();
const stopLsp = vi.fn();
const confirmDiscardUnsaved = vi.fn();

vi.mock("./api", () => ({
  api: {
    closeRepository: (...args: unknown[]) => closeRepository(...args),
    terminalCloseAll: (...args: unknown[]) => terminalCloseAll(...args),
    openRepository: (...args: unknown[]) => openRepository(...args),
    getStatus: (...args: unknown[]) => getStatus(...args),
    getBranches: (...args: unknown[]) => getBranches(...args),
    getRepoOperationState: (...args: unknown[]) => getRepoOperationState(...args),
    getRepoInfo: (...args: unknown[]) => getRepoInfo(...args),
    listProjectEntries: (...args: unknown[]) => listProjectEntries(...args),
    listWorkspaceRoots: (...args: unknown[]) => listWorkspaceRoots(...args),
    addWorkspaceFolder: (...args: unknown[]) => addWorkspaceFolder(...args),
  },
}));

vi.mock("../editor/lspClient", () => ({
  javaLspClient: {
    stop: (...args: unknown[]) => stopLsp(...args),
  },
}));

vi.mock("./unsavedGuard", () => ({
  confirmDiscardUnsaved: (...args: unknown[]) => confirmDiscardUnsaved(...args),
}));

vi.mock("./performance", () => ({
  startMeasure: vi.fn(),
  endMeasure: vi.fn(),
}));

import { switchWorkspace } from "./switchWorkspace";

function fakeQueryClient(): QueryClient {
  return {
    clear: vi.fn(),
    prefetchQuery: vi.fn(async ({ queryFn }: { queryFn: () => Promise<unknown> }) => {
      await queryFn();
    }),
  } as unknown as QueryClient;
}

const labels = {
  unsavedTitle: "unsaved",
  unsavedMessage: (n: number) => `${n}`,
  unsavedConfirm: "ok",
};

describe("switchWorkspace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });
    confirmDiscardUnsaved.mockResolvedValue(true);
    terminalCloseAll.mockResolvedValue(undefined);
    stopLsp.mockResolvedValue(undefined);
    closeRepository.mockResolvedValue(undefined);
    openRepository.mockResolvedValue({
      path: "/new",
      branch: "main",
      remotes: [],
      is_bare: false,
    });
    getStatus.mockResolvedValue({
      staged: [],
      unstaged: [],
      untracked: [],
      conflicted: [],
    });
    getBranches.mockResolvedValue([]);
    getRepoOperationState.mockResolvedValue({
      merging: false,
      rebasing: false,
      cherry_picking: false,
      reverting: false,
      conflict_count: 0,
    });
    getRepoInfo.mockResolvedValue({
      path: "/new",
      branch: "main",
      remotes: [],
      is_bare: false,
    });
    listProjectEntries.mockResolvedValue([]);
    listWorkspaceRoots.mockResolvedValue(["/new"]);
    addWorkspaceFolder.mockResolvedValue(["/new"]);
  });

  it("aborts when unsaved confirm is cancelled", async () => {
    confirmDiscardUnsaved.mockResolvedValueOnce(false);
    const qc = fakeQueryClient();
    const setRepo = vi.fn();
    const ok = await switchWorkspace("/new", qc, setRepo, labels);
    expect(ok).toBe(false);
    expect(closeRepository).not.toHaveBeenCalled();
    expect(setRepo).not.toHaveBeenCalled();
  });

  it("tears down and opens the new repository", async () => {
    const qc = fakeQueryClient();
    const setRepo = vi.fn();
    const ok = await switchWorkspace("/new", qc, setRepo, labels);
    expect(ok).toBe(true);
    expect(terminalCloseAll).toHaveBeenCalled();
    expect(stopLsp).toHaveBeenCalled();
    expect(closeRepository).toHaveBeenCalled();
    expect(qc.clear).toHaveBeenCalled();
    expect(openRepository).toHaveBeenCalledWith("/new");
    expect(setRepo).toHaveBeenCalledWith(
      expect.objectContaining({ path: "/new", branch: "main" }),
    );
  });
});
