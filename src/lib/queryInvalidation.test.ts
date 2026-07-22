import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import {
  GIT_STATE_KEYS,
  PROJECT_KEYS,
  invalidateAfterGitMutation,
  invalidateFromWorkspaceEvent,
  invalidateGitState,
  invalidateProject,
} from "./queryInvalidation";

function trackInvalidations(client: QueryClient) {
  const keys: string[][] = [];
  const original = client.invalidateQueries.bind(client);
  vi.spyOn(client, "invalidateQueries").mockImplementation(async (filters) => {
    const key = (filters as { queryKey?: unknown[] } | undefined)?.queryKey;
    if (Array.isArray(key)) {
      keys.push(key.map(String));
    }
    return original(filters as never);
  });
  return keys;
}

describe("queryInvalidation", () => {
  it("invalidateGitState touches status/repo-info/branches/operation-state", async () => {
    const client = new QueryClient();
    const keys = trackInvalidations(client);
    await invalidateGitState(client);
    expect(keys).toEqual(GIT_STATE_KEYS.map((k) => [...k]));
  });

  it("invalidateProject touches project-entries and project-tree", async () => {
    const client = new QueryClient();
    const keys = trackInvalidations(client);
    await invalidateProject(client);
    expect(keys).toEqual(PROJECT_KEYS.map((k) => [...k]));
  });

  it("invalidateAfterGitMutation includes log by default", async () => {
    const client = new QueryClient();
    const keys = trackInvalidations(client);
    await invalidateAfterGitMutation(client);
    expect(keys).toContainEqual(["log"]);
    expect(keys).toContainEqual(["status"]);
  });

  it("invalidateFromWorkspaceEvent only refreshes project when workspace paths change", async () => {
    const client = new QueryClient();
    const keys = trackInvalidations(client);
    await invalidateFromWorkspaceEvent(client, {
      gitChanged: false,
      workspaceChanged: true,
    });
    expect(keys).toContainEqual(["status"]);
    expect(keys).toContainEqual(["project-entries"]);
    expect(keys).not.toContainEqual(["branches"]);
  });

  it("invalidateFromWorkspaceEvent scopes status to rootPath", async () => {
    const client = new QueryClient();
    client.setQueryData(["status", "/tmp/repo-a"], { ok: true });
    client.setQueryData(["status", "/tmp/repo-b"], { ok: true });
    client.setQueryData(["project-entries", "/tmp/repo-b", ""], []);
    client.setQueryData(["project-tree"], []);
    await invalidateFromWorkspaceEvent(client, {
      gitChanged: false,
      workspaceChanged: true,
      rootPath: "/tmp/repo-b",
    });
    expect(client.getQueryState(["status", "/tmp/repo-b"])?.isInvalidated).toBe(true);
    expect(client.getQueryState(["status", "/tmp/repo-a"])?.isInvalidated).toBe(false);
    expect(client.getQueryState(["project-entries", "/tmp/repo-b", ""])?.isInvalidated).toBe(
      true,
    );
    expect(client.getQueryState(["project-tree"])?.isInvalidated).toBe(true);
  });

  it("invalidateFromWorkspaceEvent scopes git keys when gitChanged with rootPath", async () => {
    const client = new QueryClient();
    client.setQueryData(["status", "/tmp/repo-a"], { ok: true });
    client.setQueryData(["branches", "/tmp/repo-a"], []);
    client.setQueryData(["repo-operation-state", "/tmp/repo-a"], {});
    client.setQueryData(["project-tree"], []);
    await invalidateFromWorkspaceEvent(client, {
      gitChanged: true,
      workspaceChanged: false,
      rootPath: "/tmp/repo-a",
    });
    expect(client.getQueryState(["status", "/tmp/repo-a"])?.isInvalidated).toBe(true);
    expect(client.getQueryState(["branches", "/tmp/repo-a"])?.isInvalidated).toBe(true);
    expect(client.getQueryState(["repo-operation-state", "/tmp/repo-a"])?.isInvalidated).toBe(
      true,
    );
    expect(client.getQueryState(["project-tree"])?.isInvalidated).toBe(false);
  });
});
