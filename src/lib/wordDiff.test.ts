import { describe, expect, it } from "vitest";
import { computeWordDiff } from "./wordDiff";

describe("computeWordDiff", () => {
  it("marks only the changed middle segment", () => {
    const result = computeWordDiff("const oldValue = 1;", "const newValue = 1;");

    expect(result.old).toEqual([
      { text: "const ", changed: false },
      { text: "old", changed: true },
      { text: "Value = 1;", changed: false },
    ]);
    expect(result.new).toEqual([
      { text: "const ", changed: false },
      { text: "new", changed: true },
      { text: "Value = 1;", changed: false },
    ]);
  });

  it("keeps equal lines unchanged", () => {
    expect(computeWordDiff("same", "same")).toEqual({
      old: [{ text: "same", changed: false }],
      new: [{ text: "same", changed: false }],
    });
  });
});
