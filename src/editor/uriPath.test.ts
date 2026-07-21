import { describe, expect, it } from "vitest";
import {
  isClasspathNavigationUri,
  pathToUri,
  uriToPath,
} from "./lspClient";

describe("uriToPath / pathToUri", () => {
  it("round-trips ASCII workspace paths", () => {
    const root = "/Users/demo/project";
    const relative = "src/main/java/App.java";
    const uri = pathToUri(`${root}/${relative}`);
    expect(uriToPath(uri, root)).toBe(relative);
  });

  it("round-trips Chinese workspace paths", () => {
    const root = "/Users/demo/财小宝管理系统/caixiaobao-backend";
    const relative = "caixiaobao-admin/src/main/java/com/caixiaobao/CaixiaobaoApplication.java";
    const uri = pathToUri(`${root}/${relative}`);
    expect(uri).toContain("%E8%B4%A2");
    expect(uriToPath(uri, root)).toBe(relative);
  });

  it("keeps absolute paths outside the workspace", () => {
    const root = "/Users/demo/project";
    const abs = "/Users/demo/.m2/repository/org/springframework/Foo.java";
    expect(uriToPath(pathToUri(abs), root)).toBe(abs);
  });
});

describe("isClasspathNavigationUri", () => {
  it("detects jdt and jar class URIs", () => {
    expect(isClasspathNavigationUri("jdt://contents/java.base/java/lang/String.class")).toBe(true);
    expect(
      isClasspathNavigationUri(
        "jar:file:///Users/demo/.m2/foo.jar!/org/springframework/boot/SpringApplication.class",
      ),
    ).toBe(true);
    expect(isClasspathNavigationUri("file:///tmp/App.java")).toBe(false);
  });
});
