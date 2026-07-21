import { describe, expect, it } from "vitest";
import { jdtDisplayName } from "./lspClient";

describe("jdtDisplayName", () => {
  it("uses the path segment before the query string", () => {
    const uri =
      "jdt://contents/java.base/java.lang/String.class?=demo/%5C/jdk%5C/lib%5C/jrt-fs.jar%60java.base=/javadoc_location=/https:%5C/%5C/docs.oracle.com%5C/=/%3Cjava.lang%28String.class";
    expect(jdtDisplayName(uri)).toBe("String.class");
  });

  it("falls back to the query package suffix", () => {
    const uri =
      "jdt://contents/broken?=demo/=/%3Cjava.util%28List.class";
    expect(jdtDisplayName(uri)).toBe("List.class");
  });
});
