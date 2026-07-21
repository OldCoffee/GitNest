import { beforeEach, describe, expect, it, vi } from "vitest";

const uiConfirm = vi.fn();
vi.mock("./uiPrompt", () => ({
  uiConfirm: (...args: unknown[]) => uiConfirm(...args),
}));

const dirtyState = { paths: [] as string[] };
vi.mock("../editor/documentStore", () => ({
  documentStore: {
    dirtyPaths: () => dirtyState.paths,
  },
}));

import { confirmDiscardUnsaved } from "./unsavedGuard";

describe("confirmDiscardUnsaved", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dirtyState.paths = [];
  });

  it("proceeds without prompt when nothing is dirty", async () => {
    await expect(
      confirmDiscardUnsaved({
        title: "Close",
        message: (n) => `${n}`,
      }),
    ).resolves.toBe(true);
    expect(uiConfirm).not.toHaveBeenCalled();
  });

  it("asks and respects cancel", async () => {
    dirtyState.paths = ["a.ts", "b.ts"];
    uiConfirm.mockResolvedValueOnce(false);
    await expect(
      confirmDiscardUnsaved({
        title: "Close",
        message: (n) => `discard ${n}`,
        confirmLabel: "Discard",
      }),
    ).resolves.toBe(false);
    expect(uiConfirm).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Close",
        message: "discard 2",
        confirmLabel: "Discard",
        danger: true,
      }),
    );
  });
});
