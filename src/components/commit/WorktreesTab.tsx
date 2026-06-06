import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { api } from "../../lib/api";
import { useAppStore } from "../../store/appStore";
import { useT } from "../../context/PreferencesContext";
import { Button, EmptyState, Input, Loading, ToolbarStrip } from "../ui";

export function WorktreesTab() {
  const t = useT();
  const appendVcsOutput = useAppStore((s) => s.appendVcsOutput);
  const queryClient = useQueryClient();
  const [path, setPath] = useState("");
  const [branch, setBranch] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: worktrees = [], isLoading } = useQuery({
    queryKey: ["worktrees"],
    queryFn: api.listWorktrees,
  });

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["worktrees"] });
  }

  async function pickPath() {
    const selected = await open({ directory: true, multiple: false });
    if (typeof selected === "string") setPath(selected);
  }

  async function add() {
    if (!path.trim()) return;
    setBusy(true);
    try {
      await api.addWorktree(path.trim(), branch.trim() || null);
      appendVcsOutput(t("worktrees.added", { path }));
      setPath("");
      setBranch("");
      await refresh();
    } catch (e) {
      appendVcsOutput(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function remove(wtPath: string) {
    setBusy(true);
    try {
      await api.removeWorktree(wtPath, false);
      appendVcsOutput(t("worktrees.removed", { path: wtPath }));
      await refresh();
    } catch (e) {
      appendVcsOutput(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ToolbarStrip className="flex-col">
        <div className="flex w-full gap-1">
          <Input
            className="flex-1 text-xs"
            placeholder={t("commit.worktreePath")}
            value={path}
            onChange={(e) => setPath(e.target.value)}
          />
          <Button onClick={() => void pickPath()}>…</Button>
        </div>
        <Input
          className="text-xs"
          placeholder={t("commit.branchOptional")}
          value={branch}
          onChange={(e) => setBranch(e.target.value)}
        />
        <Button
          variant="primary"
          className="w-full"
          disabled={busy || !path.trim()}
          onClick={() => void add()}
        >
          {t("commit.addWorktree")}
        </Button>
      </ToolbarStrip>

      {isLoading && <Loading />}

      <div className="min-h-0 flex-1 overflow-auto">
        {worktrees.map((wt) => (
          <div key={wt.path} className="jb-list-row">
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs">{wt.path}</div>
              <div className="text-xs jb-text-dim">
                {wt.branch ?? t("worktrees.detached")} · {wt.head.slice(0, 7)}
              </div>
            </div>
            <Button disabled={busy} onClick={() => void remove(wt.path)}>
              {t("commit.remove")}
            </Button>
          </div>
        ))}
        {worktrees.length === 0 && !isLoading && (
          <EmptyState>{t("commit.noWorktrees")}</EmptyState>
        )}
      </div>
    </div>
  );
}
