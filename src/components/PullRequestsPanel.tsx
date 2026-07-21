import { useQuery, useQueryClient } from "@tanstack/react-query";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useMemo, useState } from "react";
import { api } from "../lib/api";
import { useAppStore } from "../store/appStore";
import { useSettings } from "../hooks/useRepo";
import { useT } from "../context/PreferencesContext";
import { Button, EmptyState, Input, ListRow, Loading, Panel, PanelBody, TextArea, ToolWindowHeader } from "./ui";
import { uiAlert } from "../lib/uiPrompt";

function parseGitHubRepo(remoteUrl: string): string | null {
  const ssh = remoteUrl.match(/git@[^:]+:([^/]+\/[^.]+)/);
  if (ssh) return ssh[1];
  const https = remoteUrl.match(/github\.com[:/]([^/]+\/[^.\s]+)/);
  if (https) return https[1].replace(/\.git$/, "");
  return null;
}

export function PullRequestsPanel() {
  const t = useT();
  const queryClient = useQueryClient();
  const repo = useAppStore((s) => s.repo);
  const selectedRemote = useAppStore((s) => s.selectedRemote);
  const setLeftToolWindow = useAppStore((s) => s.setLeftToolWindow);
  const openSettingsEditor = useAppStore((s) => s.openSettingsEditor);
  const { data: settings } = useSettings();
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [base, setBase] = useState("main");
  const [busy, setBusy] = useState(false);

  const ghRepo = useMemo(() => {
    if (!repo) return null;
    const remote = repo.remotes.find((r) => r.name === selectedRemote) ?? repo.remotes[0];
    if (!remote) return null;
    return parseGitHubRepo(remote.url);
  }, [repo, selectedRemote]);

  const account = settings?.github_account ?? null;
  const head = repo?.branch ?? "";

  const { data: prs = [], isLoading, error, refetch } = useQuery({
    queryKey: ["github-prs", ghRepo, account?.username],
    queryFn: () => {
      if (!account || !ghRepo) throw new Error("missing config");
      return api.githubListPrs(account, ghRepo);
    },
    enabled: !!account && !!ghRepo,
  });

  async function createPr() {
    if (!account || !ghRepo || !title.trim() || !head) return;
    setBusy(true);
    try {
      const created = await api.githubCreatePr(account, ghRepo, {
        title: title.trim(),
        body: body.trim(),
        head,
        base: base.trim() || "main",
      });
      setCreating(false);
      setTitle("");
      setBody("");
      await queryClient.invalidateQueries({ queryKey: ["github-prs"] });
      await refetch();
      try {
        await openUrl(created.url);
      } catch {
        // ignore opener failures
      }
    } catch (e) {
      void uiAlert(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel>
      <ToolWindowHeader
        title={t("panels.pullRequests")}
        actions={
          <>
            {account && ghRepo && (
              <Button size="sm" onClick={() => setCreating((v) => !v)}>
                {t("panels.createPr")}
              </Button>
            )}
            <Button variant="icon" onClick={() => setLeftToolWindow("git")} aria-label={t("common.close")}>
              ×
            </Button>
          </>
        }
      />

      {!account && (
        <EmptyState>
          {t("panels.configureGithub")}{" "}
          <Button size="sm" onClick={() => openSettingsEditor()}>
            {t("toolbar.settings")}
          </Button>
        </EmptyState>
      )}
      {account && !ghRepo && <EmptyState>{t("panels.parseGithubError")}</EmptyState>}
      {error && <EmptyState className="jb-text-error">{String(error)}</EmptyState>}
      {isLoading && <Loading />}

      {creating && account && ghRepo && (
        <div className="flex flex-col gap-2 border-b border-[var(--jb-border)] p-2">
          <Input
            placeholder={t("panels.prTitle")}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <TextArea
            rows={3}
            placeholder={t("panels.prBody")}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <Input
            placeholder={t("panels.prBase")}
            value={base}
            onChange={(e) => setBase(e.target.value)}
          />
          <div className="text-xs jb-text-dim">
            {head} → {base || "main"}
          </div>
          <Button
            variant="primary"
            size="sm"
            disabled={busy || !title.trim()}
            onClick={() => void createPr()}
          >
            {busy ? t("common.loading") : t("panels.createPrSubmit")}
          </Button>
        </div>
      )}

      <PanelBody>
        {prs.map((pr) => (
          <ListRow
            key={pr.number}
            layout="stack"
            onClick={() => void openUrl(pr.url).catch(() => undefined)}
          >
            <div className="text-xs font-medium">
              #{pr.number} {pr.title}
            </div>
            <div className="text-xs jb-text-dim">
              {pr.author} · {pr.state} · {pr.head} → {pr.base}
            </div>
          </ListRow>
        ))}
        {prs.length === 0 && account && ghRepo && !isLoading && (
          <EmptyState>{t("panels.noOpenPrs")}</EmptyState>
        )}
      </PanelBody>
    </Panel>
  );
}
