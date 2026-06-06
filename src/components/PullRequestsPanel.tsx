import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { api } from "../lib/api";
import { useAppStore } from "../store/appStore";
import { useSettings } from "../hooks/useRepo";
import { useT } from "../context/PreferencesContext";
import { Button, EmptyState, ListRow, Loading, Panel, PanelBody, ToolWindowHeader } from "./ui";

function parseGitHubRepo(remoteUrl: string): string | null {
  const ssh = remoteUrl.match(/git@[^:]+:([^/]+\/[^.]+)/);
  if (ssh) return ssh[1];
  const https = remoteUrl.match(/github\.com[:/]([^/]+\/[^.]+)/);
  if (https) return https[1].replace(/\.git$/, "");
  return null;
}

export function PullRequestsPanel() {
  const t = useT();
  const repo = useAppStore((s) => s.repo);
  const selectedRemote = useAppStore((s) => s.selectedRemote);
  const setLeftToolWindow = useAppStore((s) => s.setLeftToolWindow);
  const { data: settings } = useSettings();

  const ghRepo = useMemo(() => {
    if (!repo) return null;
    const remote = repo.remotes.find((r) => r.name === selectedRemote) ?? repo.remotes[0];
    if (!remote) return null;
    return parseGitHubRepo(remote.url);
  }, [repo, selectedRemote]);

  const account = settings?.github_account ?? null;

  const { data: prs = [], isLoading, error } = useQuery({
    queryKey: ["github-prs", ghRepo, account?.username],
    queryFn: () => {
      if (!account || !ghRepo) throw new Error("missing config");
      return api.githubListPrs(account, ghRepo);
    },
    enabled: !!account && !!ghRepo,
  });

  return (
    <Panel>
      <ToolWindowHeader
        title={t("panels.pullRequests")}
        actions={
          <Button variant="icon" onClick={() => setLeftToolWindow("git")} aria-label={t("common.close")}>
            ×
          </Button>
        }
      />

      {!account && <EmptyState>{t("panels.configureGithub")}</EmptyState>}
      {account && !ghRepo && <EmptyState>{t("panels.parseGithubError")}</EmptyState>}
      {error && <EmptyState className="jb-text-error">{String(error)}</EmptyState>}
      {isLoading && <Loading />}

      <PanelBody>
        {prs.map((pr) => (
          <ListRow
            key={pr.number}
            as="a"
            layout="stack"
            href={pr.url}
            target="_blank"
            rel="noreferrer"
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
