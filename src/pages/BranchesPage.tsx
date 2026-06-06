import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { BranchInfo } from "../lib/types";
import { useAppStore } from "../store/appStore";
import { useBranches, useInvalidateRepo } from "../hooks/useRepo";
import { BranchTreeView } from "../components/BranchTreeView";
import { Button, Input, SearchInput } from "../components/ui";
import { useT } from "../context/PreferencesContext";

export function BranchesPage() {
  const t = useT();
  const appendVcsOutput = useAppStore((s) => s.appendVcsOutput);
  const { data: branches = [], refetch, isFetching } = useBranches(true);
  const [newBranch, setNewBranch] = useState("");
  const [filter, setFilter] = useState("");
  const invalidate = useInvalidateRepo();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function checkout(branch: BranchInfo) {
    setBusy(true);
    setError(null);
    try {
      await api.checkoutBranch(branch.name);
      await invalidate();
      await refetch();
      await queryClient.invalidateQueries({ queryKey: ["status"] });
      await queryClient.invalidateQueries({ queryKey: ["log"] });
    } catch (e) {
      const msg = String(e);
      setError(msg);
      appendVcsOutput(msg);
    } finally {
      setBusy(false);
    }
  }

  async function createBranch() {
    const name = newBranch.trim();
    if (!name) return;
    setBusy(true);
    try {
      await api.createNewBranch(name);
      setNewBranch("");
      await refetch();
      await checkout({
        name,
        is_remote: false,
        is_current: false,
        upstream: null,
        last_commit: null,
        ahead: 0,
        behind: 0,
      });
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function deleteBranch(name: string) {
    if (!confirm(t("branches.deleteConfirm", { name }))) return;
    setBusy(true);
    try {
      await api.deleteExistingBranch(name, false);
      await refetch();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="jb-page-header">
        <h2 className="jb-page-title mb-3">{t("branches.title")}</h2>
        <div className="mb-3 flex gap-2">
          <SearchInput
            wrapClassName="flex-1"
            placeholder={t("branches.filter")}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          <Button onClick={() => void refetch()}>{isFetching ? "…" : t("common.refresh")}</Button>
        </div>
        <div className="flex gap-2">
          <Input
            value={newBranch}
            onChange={(e) => setNewBranch(e.target.value)}
            placeholder={t("branches.newBranch")}
            className="flex-1"
            onKeyDown={(e) => {
              if (e.key === "Enter") void createBranch();
            }}
          />
          <Button variant="primary" onClick={() => void createBranch()}>
            {t("common.create")}
          </Button>
        </div>
        {error && <div className="mt-2 text-xs jb-text-error">{error}</div>}
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <BranchTreeView
          branches={branches}
          mode="both"
          filter={filter}
          onSelect={checkout}
          onDelete={deleteBranch}
          busy={busy}
        />
      </div>
    </div>
  );
}
