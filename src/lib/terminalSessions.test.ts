import { describe, expect, it } from "vitest";
import {
  acceptCreatedSession,
  nextActiveAfterClose,
  pathBasename,
  removeTerminalSession,
  sessionsToCloseOnDispose,
} from "./terminalSessions";

describe("terminalSessions", () => {
  it("extracts basename for cwd tooltips", () => {
    expect(pathBasename("/Users/me/GitNest")).toBe("GitNest");
    expect(pathBasename("C:\\Users\\me\\GitNest\\")).toBe("GitNest");
  });

  it("removes a session id", () => {
    expect(removeTerminalSession([1, 2, 3], 2)).toEqual([1, 3]);
  });

  it("picks the last remaining tab after closing the active one", () => {
    expect(nextActiveAfterClose([1, 2, 3], 3, 3)).toBe(2);
    expect(nextActiveAfterClose([1], 1, 1)).toBeNull();
  });

  it("keeps active when a non-active tab is closed", () => {
    expect(nextActiveAfterClose([1, 2, 3], 1, 3)).toBe(3);
  });

  it("closes orphan sessions created after dispose (StrictMode / unmount race)", () => {
    expect(acceptCreatedSession([1], 2, true)).toEqual({
      sessions: [1],
      shouldClose: true,
    });
  });

  it("appends sessions when still mounted", () => {
    expect(acceptCreatedSession([1], 2, false)).toEqual({
      sessions: [1, 2],
      shouldClose: false,
    });
  });

  it("dedupes dispose close list", () => {
    expect(sessionsToCloseOnDispose([1, 2], [2, 3])).toEqual([1, 2, 3]);
  });
});
