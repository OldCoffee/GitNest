import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProjectFileText } from "../lib/types";

const readTextFile = vi.fn();
const readAbsoluteTextFile = vi.fn();
const writeTextFile = vi.fn();
const decompileClassFile = vi.fn();

vi.mock("../lib/api", () => ({
  api: {
    readTextFile: (...args: unknown[]) => readTextFile(...args),
    readAbsoluteTextFile: (...args: unknown[]) => readAbsoluteTextFile(...args),
    writeTextFile: (...args: unknown[]) => writeTextFile(...args),
    decompileClassFile: (...args: unknown[]) => decompileClassFile(...args),
  },
}));

vi.mock("./lspClient", () => ({
  isJdtUri: (path: string) => path.startsWith("jdt://"),
  javaLspClient: {
    classFileContents: vi.fn(),
  },
}));

import { DocumentStore } from "./documentStore";

function fileText(
  content: string,
  modifiedMs = 1_000,
): ProjectFileText {
  return {
    content,
    is_binary: false,
    too_large: false,
    size_bytes: new TextEncoder().encode(content).length,
    modified_ms: modifiedMs,
  };
}

describe("DocumentStore conflict flow", () => {
  let store: DocumentStore;

  beforeEach(() => {
    store = new DocumentStore();
    readTextFile.mockReset();
    readAbsoluteTextFile.mockReset();
    writeTextFile.mockReset();
    decompileClassFile.mockReset();
  });

  async function loadPath(path: string, content: string, modifiedMs = 1_000) {
    readTextFile.mockResolvedValueOnce(fileText(content, modifiedMs));
    await store.load(path);
    return store.peek(path)!;
  }

  it("marks dirty after edit and clears dirty after save", async () => {
    const path = "src/a.ts";
    await loadPath(path, "hello");

    store.update(path, "hello world");
    expect(store.peek(path)?.dirty).toBe(true);
    expect(store.isDirty(path)).toBe(true);

    writeTextFile.mockResolvedValueOnce(2_000);
    await store.save(path);

    const after = store.peek(path)!;
    expect(after.dirty).toBe(false);
    expect(after.savedText).toBe("hello world");
    expect(after.modifiedMs).toBe(2_000);
    expect(after.externalText).toBeNull();
    expect(writeTextFile).toHaveBeenCalledWith(path, "hello world", 1_000, false);
  });

  it("sets externalText when save hits FILE_MODIFIED", async () => {
    const path = "src/conflict.ts";
    await loadPath(path, "local-base", 1_000);

    store.update(path, "local-edit");
    writeTextFile.mockRejectedValueOnce(new Error("FILE_MODIFIED: file changed on disk"));
    readTextFile.mockResolvedValueOnce(fileText("disk-version", 2_000));

    await expect(store.save(path)).rejects.toThrow(/FILE_MODIFIED/);

    const snap = store.peek(path)!;
    expect(snap.externalText).toBe("disk-version");
    expect(snap.modifiedMs).toBe(2_000);
    expect(snap.text).toBe("local-edit");
    expect(snap.dirty).toBe(true);
    expect(snap.saving).toBe(false);
  });

  it("applyDiskChange surfaces externalText for dirty docs", async () => {
    const path = "src/watched.ts";
    await loadPath(path, "saved", 1_000);
    store.update(path, "unsaved");

    readTextFile.mockResolvedValueOnce(fileText("from-disk", 3_000));
    await store.applyDiskChange(path);

    const snap = store.peek(path)!;
    expect(snap.externalText).toBe("from-disk");
    expect(snap.modifiedMs).toBe(3_000);
    expect(snap.text).toBe("unsaved");
    expect(snap.dirty).toBe(true);
  });

  it("applyDiskChange reloads clean docs from disk", async () => {
    const path = "src/clean.ts";
    await loadPath(path, "v1", 1_000);

    readTextFile.mockResolvedValueOnce(fileText("v2", 4_000));
    await store.applyDiskChange(path);

    const snap = store.peek(path)!;
    expect(snap.text).toBe("v2");
    expect(snap.savedText).toBe("v2");
    expect(snap.dirty).toBe(false);
    expect(snap.externalText).toBeNull();
    expect(snap.modifiedMs).toBe(4_000);
  });

  it("acceptExternal reloads disk content and clears conflict/dirty", async () => {
    const path = "src/accept.ts";
    await loadPath(path, "base", 1_000);
    store.update(path, "mine");

    writeTextFile.mockRejectedValueOnce(new Error("FILE_MODIFIED: file changed on disk"));
    readTextFile.mockResolvedValueOnce(fileText("theirs", 5_000));
    await expect(store.save(path)).rejects.toThrow(/FILE_MODIFIED/);

    store.acceptExternal(path);

    const snap = store.peek(path)!;
    expect(snap.text).toBe("theirs");
    expect(snap.savedText).toBe("theirs");
    expect(snap.externalText).toBeNull();
    expect(snap.dirty).toBe(false);
    expect(snap.error).toBeNull();
  });

  it("blocks non-force save while conflict is active", async () => {
    const path = "src/block.ts";
    await loadPath(path, "base", 1_000);
    store.update(path, "mine");

    writeTextFile.mockRejectedValueOnce(new Error("FILE_MODIFIED: file changed on disk"));
    readTextFile.mockResolvedValueOnce(fileText("theirs", 6_000));
    await expect(store.save(path)).rejects.toThrow(/FILE_MODIFIED/);

    writeTextFile.mockClear();
    await store.save(path, false);

    expect(writeTextFile).not.toHaveBeenCalled();
    expect(store.peek(path)?.externalText).toBe("theirs");
    expect(store.peek(path)?.dirty).toBe(true);
  });

  it("save(force) overwrites disk and clears conflict", async () => {
    const path = "src/overwrite.ts";
    await loadPath(path, "base", 1_000);
    store.update(path, "mine");

    writeTextFile.mockRejectedValueOnce(new Error("FILE_MODIFIED: file changed on disk"));
    readTextFile.mockResolvedValueOnce(fileText("theirs", 7_000));
    await expect(store.save(path)).rejects.toThrow(/FILE_MODIFIED/);

    writeTextFile.mockResolvedValueOnce(8_000);
    await store.save(path, true);

    const snap = store.peek(path)!;
    expect(snap.externalText).toBeNull();
    expect(snap.dirty).toBe(false);
    expect(snap.savedText).toBe("mine");
    expect(snap.modifiedMs).toBe(8_000);
    expect(snap.error).toBeNull();
    expect(writeTextFile).toHaveBeenLastCalledWith(path, "mine", 7_000, true);
  });

  it("close requires confirm when dirty; succeeds when clean or forced", async () => {
    const path = "src/close.ts";
    await loadPath(path, "base");

    expect(store.close(path)).toBe(true);
    expect(store.has(path)).toBe(false);

    await loadPath(path, "base");
    store.update(path, "edited");
    expect(store.close(path)).toBe(false);
    expect(store.has(path)).toBe(true);
    expect(store.isDirty(path)).toBe(true);

    expect(store.close(path, true)).toBe(true);
    expect(store.has(path)).toBe(false);
  });

  it("editing back to savedText clears dirty", async () => {
    const path = "src/revert.ts";
    await loadPath(path, "same");
    store.update(path, "changed");
    expect(store.isDirty(path)).toBe(true);
    store.update(path, "same");
    expect(store.isDirty(path)).toBe(false);
  });
});
