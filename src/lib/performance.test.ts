import { afterEach, describe, expect, it } from "vitest";
import {
  clearMeasuredEntries,
  endMeasure,
  measuredEntries,
  startMeasure,
} from "./performance";

afterEach(() => {
  clearMeasuredEntries();
});

describe("performance marks", () => {
  it("records duration between start and end", () => {
    startMeasure("git.status");
    const duration = endMeasure("git.status");
    expect(duration).not.toBeNull();
    expect(duration!).toBeGreaterThanOrEqual(0);
    expect(measuredEntries()["git.status"]).toBeGreaterThanOrEqual(0);
  });

  it("returns null when end is called without start", () => {
    expect(endMeasure("repo.open")).toBeNull();
  });

  it("replaces a previous start mark", () => {
    startMeasure("file.open");
    startMeasure("file.open");
    expect(endMeasure("file.open")).not.toBeNull();
    expect(endMeasure("file.open")).toBeNull();
  });
});
