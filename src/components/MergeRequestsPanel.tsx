import { useQuery, useQueryClient } from "@tanstack/react-query";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useMemo, useState } from "react";
import { api } from "../lib/api";
import { useAppStore } from "../store/appStore";
import { useSettings } from "../hooks/useRepo";
import { useT } from "../context/PreferencesContext";
import { Button, EmptyState, Input, ListRow, Loading, Panel, PanelBody, TextArea, ToolWindowHeader } from "./ui";
import { uiAlert } from "../lib/uiPrompt";

function parseGitLabProject(remoteUrl: string): string | null {
  const ssh = remoteUrl.match(/git@[^:]+:(.+?)(?:\.git)?$/);
  if (ssh) return ssh[1];
  const https = remoteUrl.match(/https?:\/\/[^/]+\/(.+?)(?:\.git)?$/);
  if (https) return https[1];
  return null;
}

export function MergeRequestsPanel() {
  const t = useT();
  const queryClient = useQueryClient();
  const repo = useAppStore((s) => s.repo);
  const selectedRemote = useAppStore((s) => s.selectedRemote);
  const setLeftToolWindow = useAppStore((s) => s.setLeftToolWindow);
  const openSettingsEditor = useAppStore((s) => s.openSettingsEditor);
  const { data: settings } = useSettings();
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [target, setTarget] = useState("main");
  const [busy, setBusy] = useState(false);

  const project = useMemo(() => {
    if (!repo) return null;
    const remote = repo.remotes.find((r) => r.name === selectedRemote) ?? repo.remotes[0];
    if (!remote) return null;
    return parseGitLabProject(remote.url);
  }, [repo, selectedRemote]);

  const account = settings?.gitlab_account ?? null;
  const source = repo?.branch ?? "";

  const { data: mrs = [], isLoading, error, refetch } = useQuery({
    queryKey: ["gitlab-mrs", project, account?.username],
    queryFn: () => {
      if (!account || !project) throw new Error("missing config");
      return api.gitlabListMrs(account, project);
    },
    enabled: !!account && !!project,
  });

  async function createMr() {
    if (!account || !project || !title.trim() || !source) return;
    setBusy(true);
    try {
      const created = await api.gitlabCreateMr(account, project, {
        title: title.trim(),
        description: description.trim(),
        source_branch: source,
        target_branch: target.trim() || "main",
      });
      setCreating(false);
      setTitle("");
      setDescription("");
      await queryClient.invalidateQueries({ queryKey: ["gitlab-mrs"] });
      await refetch();
      try {
        await openUrl(created.url);
      } catch {
        // ignore
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
        title={t("panels.mergeRequests")}
        actions={
          <>
            {account && project && (
              <Button size="sm" onClick={() => setCreating((v) => !v)}>
                {t("panels.createMr")}
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
          {t("panels.configureGitlab")}{" "}
          <Button size="sm" onClick={() => openSettingsEditor()}>
            {t("toolbar.settings")}
          </Button>
        </EmptyState>
      )}
      {account && !project && <EmptyState>{t("panels.parseGitlabError")}</EmptyState>}
      {error && <EmptyState className="jb-text-error">{String(error)}</EmptyState>}
      {isLoading && <Loading />}

      {creating && account && project && (
        <div className="flex flex-col gap-2 border-b border-[var(--jb-border)] p-2">
          <Input
            placeholder={t("panels.mrTitle")}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <TextArea
            rows={3}
            placeholder={t("panels.mrBody")}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <Input
            placeholder={t("panels.mrTarget")}
            value={target}
            onChange={(e) => setTarget(e.target.value)}
          />
          <div className="text-xs jb-text-dim">
            {source} → {target || "main"}
          </div>
          <Button
            variant="primary"
            size="sm"
            disabled={busy || !title.trim()}
            onClick={() => void createMr()}
          >
            {busy ? t("common.loading") : t("panels.createMrSubmit")}
          </Button>
        </div>
      )}

      <PanelBody>
        {mrs.map((mr) => (
          <ListRow
            key={mr.iid}
            layout="stack"
            onClick={() => void openUrl(mr.url).catch(() => undefined)}
          >
            <div className="text-xs font-medium">
              !{mr.iid} {mr.title}
            </div>
            <div className="text-xs jb-text-dim">
              {mr.author} · {mr.state} · {mr.source_branch} → {mr.target_branch}
            </div>
          </ListRow>
        ))}
        {mrs.length === 0 && account && project && !isLoading && (
          <EmptyState>{t("panels.noOpenMrs")}</EmptyState>
        )}
      </PanelBody>
    </Panel>
  );
}
