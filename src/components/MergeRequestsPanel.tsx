import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { api } from "../lib/api";
import { useAppStore } from "../store/appStore";
import { useSettings } from "../hooks/useRepo";
import { useT } from "../context/PreferencesContext";
import { Button, EmptyState, ListRow, Loading, Panel, PanelBody, ToolWindowHeader } from "./ui";

function parseGitLabProject(remoteUrl: string): string | null {
  const ssh = remoteUrl.match(/git@[^:]+:([^/]+(?:\/[^/]+)*?)(?:\.git)?$/);
  if (ssh) return encodeURIComponent(ssh[1]);
  try {
    const u = new URL(remoteUrl.replace(/\.git$/, ""));
    const path = u.pathname.replace(/^\//, "");
    return path ? encodeURIComponent(path) : null;
  } catch {
    return null;
  }
}

export function MergeRequestsPanel() {
  const t = useT();
  const repo = useAppStore((s) => s.repo);
  const selectedRemote = useAppStore((s) => s.selectedRemote);
  const setLeftToolWindow = useAppStore((s) => s.setLeftToolWindow);
  const { data: settings } = useSettings();

  const project = useMemo(() => {
    if (!repo) return null;
    const remote = repo.remotes.find((r) => r.name === selectedRemote) ?? repo.remotes[0];
    if (!remote) return null;
    return parseGitLabProject(remote.url);
  }, [repo, selectedRemote]);

  const account = settings?.gitlab_account ?? null;

  const { data: mrs = [], isLoading, error } = useQuery({
    queryKey: ["gitlab-mrs", project, account?.username],
    queryFn: () => {
      if (!account || !project) throw new Error("missing config");
      return api.gitlabListMrs(account, project);
    },
    enabled: !!account && !!project,
  });

  return (
    <Panel>
      <ToolWindowHeader
        title={t("panels.mergeRequests")}
        actions={
          <Button variant="icon" onClick={() => setLeftToolWindow("git")} aria-label={t("common.close")}>
            ×
          </Button>
        }
      />

      {!account && <EmptyState>{t("panels.configureGitlab")}</EmptyState>}
      {account && !project && <EmptyState>{t("panels.parseGitlabError")}</EmptyState>}
      {error && <EmptyState className="jb-text-error">{String(error)}</EmptyState>}
      {isLoading && <Loading />}

      <PanelBody>
        {mrs.map((mr) => (
          <ListRow
            key={mr.iid}
            as="a"
            layout="stack"
            href={mr.url}
            target="_blank"
            rel="noreferrer"
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
