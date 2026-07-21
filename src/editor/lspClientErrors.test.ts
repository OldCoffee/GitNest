import { describe, expect, it } from "vitest";
import {
  formatLspError,
  isConfigurationLspError,
  LSP_CONFIG_FAILURE_COOLDOWN_MS,
  LSP_TRANSIENT_FAILURE_COOLDOWN_MS,
  shouldReuseStartFailure,
  type LspStartFailure,
} from "./lspClient";

describe("formatLspError", () => {
  it("formats strings, Errors, and JSON-RPC style objects", () => {
    expect(formatLspError(null)).toBe("Unknown language server error");
    expect(formatLspError("No JDK found")).toBe("No JDK found");
    expect(formatLspError(new Error("boom"))).toBe("boom");
    expect(formatLspError({ message: "timed out", code: -32000 })).toBe(
      "timed out (-32000)",
    );
  });
});

describe("isConfigurationLspError", () => {
  it("detects missing / invalid JDK and JDT LS messages from the backend", () => {
    expect(isConfigurationLspError("No JDK found. Install a JDK or choose one manually.")).toBe(
      true,
    );
    expect(
      isConfigurationLspError(
        "No JDK found. Install a JDK or choose one manually in Settings → Java.",
      ),
    ).toBe(true);
    expect(isConfigurationLspError("Configured JDK not found: /opt/bad")).toBe(true);
    expect(
      isConfigurationLspError(
        "Configured JDT LS is invalid (need plugins/ and config_*): /tmp/x",
      ),
    ).toBe(true);
    expect(
      isConfigurationLspError(
        "JDT Language Server requires JDK 21+ to run (current project JDK is 17.0.10).",
      ),
    ).toBe(true);
    expect(isConfigurationLspError("Java language server is not configured")).toBe(true);
    expect(isConfigurationLspError("Language server request timed out: initialize")).toBe(
      false,
    );
    expect(isConfigurationLspError("Java language server is not running")).toBe(false);
  });
});

describe("shouldReuseStartFailure", () => {
  const base: LspStartFailure = {
    rootPath: "/repo",
    message: "No JDK found",
    at: 1_000_000,
    configuration: true,
  };

  it("reuses config failures within the long cooldown", () => {
    expect(
      shouldReuseStartFailure(base, "/repo", base.at + LSP_CONFIG_FAILURE_COOLDOWN_MS - 1),
    ).toBe(true);
    expect(
      shouldReuseStartFailure(base, "/repo", base.at + LSP_CONFIG_FAILURE_COOLDOWN_MS),
    ).toBe(false);
  });

  it("uses a shorter cooldown for transient failures", () => {
    const transient = { ...base, configuration: false, message: "initialize timed out" };
    expect(
      shouldReuseStartFailure(
        transient,
        "/repo",
        transient.at + LSP_TRANSIENT_FAILURE_COOLDOWN_MS - 1,
      ),
    ).toBe(true);
    expect(
      shouldReuseStartFailure(
        transient,
        "/repo",
        transient.at + LSP_TRANSIENT_FAILURE_COOLDOWN_MS,
      ),
    ).toBe(false);
  });

  it("does not reuse failures for a different workspace root", () => {
    expect(shouldReuseStartFailure(base, "/other", base.at + 1)).toBe(false);
    expect(shouldReuseStartFailure(null, "/repo", base.at + 1)).toBe(false);
  });
});
