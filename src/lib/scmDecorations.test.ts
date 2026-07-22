import { describe, expect, it } from "vitest";
import {
  buildScmDecorationMap,
  countDirtyPaths,
  lookupScmStatus,
  statusEntryRelPath,
} from "./scmDecorations";
import type { StatusSnapshot } from "./types";

function snap(partial: Partial<StatusSnapshot>): StatusSnapshot {
  return {
    staged: [],
    unstaged: [],
    untracked: [],
    conflicted: [],
    ...partial,
  };
}

describe("scmDecorations", () => {
  it("maps relative status paths and aggregates parents", () => {
    const map = buildScmDecorationMap(
      snap({
        unstaged: [
          {
            path: "src/app.ts",
            old_path: null,
            status: "modified",
            staged: false,
          },
        ],
        conflicted: [
          {
            path: "src/conflict.ts",
            old_path: null,
            status: "conflicted",
            staged: false,
          },
        ],
      }),
      "/repo",
    );
    expect(lookupScmStatus(map, "src/app.ts")).toBe("modified");
    expect(lookupScmStatus(map, "src")).toBe("modified");
    expect(lookupScmStatus(map, "src/conflict.ts")).toBe("conflicted");
    expect(lookupScmStatus(map, "/repo/src/app.ts")).toBe("modified");
  });

  it("maps absolute status paths under extra roots", () => {
    const map = buildScmDecorationMap(
      snap({
        untracked: [
          {
            path: "/other/README.md",
            old_path: null,
            status: "untracked",
            staged: false,
          },
        ],
      }),
      "/other",
    );
    expect(statusEntryRelPath(
      {
        path: "/other/README.md",
        old_path: null,
        status: "untracked",
        staged: false,
      },
      "/other",
    )).toBe("README.md");
    expect(lookupScmStatus(map, "README.md")).toBe("untracked");
    expect(lookupScmStatus(map, "/other/README.md")).toBe("untracked");
  });

  it("counts leaf dirty paths", () => {
    const map = buildScmDecorationMap(
      snap({
        unstaged: [
          {
            path: "a/b.ts",
            old_path: null,
            status: "modified",
            staged: false,
          },
          {
            path: "c.ts",
            old_path: null,
            status: "modified",
            staged: false,
          },
        ],
      }),
      "/repo",
    );
    expect(countDirtyPaths(map)).toBe(2);
  });

  it("can omit relative keys for non-active roots", () => {
    const map = buildScmDecorationMap(
      snap({
        unstaged: [
          {
            path: "/other/a.ts",
            old_path: null,
            status: "modified",
            staged: false,
          },
        ],
      }),
      "/other",
      { includeRelativeKeys: false },
    );
    expect(lookupScmStatus(map, "a.ts")).toBeNull();
    expect(lookupScmStatus(map, "/other/a.ts")).toBe("modified");
  });
});
