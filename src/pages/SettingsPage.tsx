import { useEffect, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { AppSettings, GitHubAccount, GitLabAccount } from "../lib/types";
import { useSettings } from "../hooks/useRepo";
import { useAppStore } from "../store/appStore";
import { Button, Input, ToolWindowHeader } from "../components/ui";
import { useT } from "../context/PreferencesContext";
import { applyLanguage, applyTheme } from "../lib/theme";
import type { UiLanguage, UiTheme } from "../lib/types";

const DEFAULT_SETTINGS: AppSettings = {
  git_path: "git",
  auto_fetch_minutes: 0,
  recent_repos: [],
  default_remote: "origin",
  shell_path: "",
  diff_mode: "unified",
  github_account: null,
  gitlab_account: null,
  store_settings_in_project: false,
  confirm_discard: true,
  ui_theme: "dark",
  ui_language: "en",
};

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="jb-page-section">
      <ToolWindowHeader title={title} className="mb-3 rounded" />
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block text-xs">
      <span className="jb-field-label">{label}</span>
      {children}
    </label>
  );
}

export function SettingsPage() {
  const t = useT();
  const { data: loaded } = useSettings();
  const queryClient = useQueryClient();
  const repo = useAppStore((s) => s.repo);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState(false);
  const [verifyMsg, setVerifyMsg] = useState<string | null>(null);
  const [newRemoteName, setNewRemoteName] = useState("");
  const [newRemoteUrl, setNewRemoteUrl] = useState("");

  const { data: remotes = [], refetch: refetchRemotes } = useQuery({
    queryKey: ["remotes"],
    queryFn: api.getRemotes,
    enabled: !!repo,
  });

  useEffect(() => {
    if (loaded) setSettings(loaded);
  }, [loaded]);

  async function save() {
    await api.saveSettings(settings);
    await queryClient.invalidateQueries({ queryKey: ["settings"] });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function previewUiPreference(patch: Partial<Pick<AppSettings, "ui_theme" | "ui_language">>) {
    const next = { ...settings, ...patch };
    setSettings(next);
    if (patch.ui_theme) applyTheme(patch.ui_theme);
    if (patch.ui_language) applyLanguage(patch.ui_language);
    queryClient.setQueryData<AppSettings>(["settings"], (old) =>
      old ? { ...old, ...patch } : next,
    );
  }

  function updateGitHub(patch: Partial<GitHubAccount>) {
    setSettings((s) => ({
      ...s,
      github_account: {
        username: s.github_account?.username ?? "",
        token: s.github_account?.token ?? "",
        ...patch,
      },
    }));
  }

  function updateGitLab(patch: Partial<GitLabAccount>) {
    setSettings((s) => ({
      ...s,
      gitlab_account: {
        username: s.gitlab_account?.username ?? "",
        token: s.gitlab_account?.token ?? "",
        host: s.gitlab_account?.host ?? "https://gitlab.com",
        ...patch,
      },
    }));
  }

  async function verifyGitHub() {
    if (!settings.github_account) return;
    try {
      const msg = await api.githubVerify(settings.github_account);
      setVerifyMsg(msg);
    } catch (e) {
      setVerifyMsg(String(e));
    }
  }

  async function verifyGitLab() {
    if (!settings.gitlab_account) return;
    try {
      const msg = await api.gitlabVerify(settings.gitlab_account);
      setVerifyMsg(msg);
    } catch (e) {
      setVerifyMsg(String(e));
    }
  }

  return (
    <div className="jb-page">
      <div className="mx-auto max-w-2xl">
        <h2 className="jb-page-title">{t("settings.title")}</h2>

        <Section title={t("settings.git")}>
          <Field label={t("settings.gitPath")}>
            <Input
              value={settings.git_path}
              onChange={(e) =>
                setSettings((s) => ({ ...s, git_path: e.target.value }))
              }
            />
          </Field>
          <Field label={t("settings.defaultRemote")}>
            <Input
              value={settings.default_remote}
              onChange={(e) =>
                setSettings((s) => ({ ...s, default_remote: e.target.value }))
              }
            />
          </Field>
          <Field label={t("settings.autoFetch")}>
            <Input
              type="number"
              min={0}
              value={settings.auto_fetch_minutes}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  auto_fetch_minutes: Number(e.target.value),
                }))
              }
            />
          </Field>
        </Section>

        {repo && (
          <Section title={t("settings.remotes")}>
            {remotes.map((remote) => (
              <div key={remote.name} className="jb-card-row">
                <span className="text-xs font-medium">{remote.name}</span>
                <Input
                  className="min-w-0 flex-1 text-xs"
                  defaultValue={remote.url}
                  onBlur={(e) => {
                    const url = e.target.value.trim();
                    if (url && url !== remote.url) {
                      void api.gitSetRemoteUrl(remote.name, url).then(() => refetchRemotes());
                    }
                  }}
                />
                <Button
                  variant="toolbar"
                  className="py-0 text-xs"
                  onClick={() => {
                    if (confirm(t("settings.removeRemoteConfirm", { name: remote.name }))) {
                      void api.gitRemoveRemote(remote.name).then(() => refetchRemotes());
                    }
                  }}
                >
                  {t("commit.remove")}
                </Button>
              </div>
            ))}
            <div className="flex gap-2">
              <Input
                className="flex-1 text-xs"
                placeholder={t("settings.remoteName")}
                value={newRemoteName}
                onChange={(e) => setNewRemoteName(e.target.value)}
              />
              <Input
                className="min-w-0 flex-1 text-xs"
                placeholder={t("settings.remoteUrl")}
                value={newRemoteUrl}
                onChange={(e) => setNewRemoteUrl(e.target.value)}
              />
              <Button
                disabled={!newRemoteName.trim() || !newRemoteUrl.trim()}
                onClick={() => {
                  void api
                    .gitAddRemote(newRemoteName.trim(), newRemoteUrl.trim())
                    .then(() => {
                      setNewRemoteName("");
                      setNewRemoteUrl("");
                      return refetchRemotes();
                    });
                }}
              >
                {t("settings.add")}
              </Button>
            </div>
          </Section>
        )}

        <Section title={t("settings.commitSection")}>
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={settings.confirm_discard}
              onChange={(e) =>
                setSettings((s) => ({ ...s, confirm_discard: e.target.checked }))
              }
            />
            {t("settings.confirmDiscard")}
          </label>
        </Section>

        <Section title={t("settings.logSection")}>
          <p className="text-xs jb-text-dim">{t("settings.logHint")}</p>
        </Section>

        <Section title={t("settings.terminalSection")}>
          <Field label={t("settings.shellPath")}>
            <Input
              value={settings.shell_path}
              onChange={(e) =>
                setSettings((s) => ({ ...s, shell_path: e.target.value }))
              }
            />
          </Field>
        </Section>

        <Section title={t("settings.github")}>
          <Field label={t("settings.username")}>
            <Input
              value={settings.github_account?.username ?? ""}
              onChange={(e) => updateGitHub({ username: e.target.value })}
            />
          </Field>
          <Field label={t("settings.token")}>
            <Input
              type="password"
              value={settings.github_account?.token ?? ""}
              onChange={(e) => updateGitHub({ token: e.target.value })}
            />
          </Field>
          <Button onClick={() => void verifyGitHub()}>{t("settings.verifyGithub")}</Button>
        </Section>

        <Section title={t("settings.gitlab")}>
          <Field label={t("settings.host")}>
            <Input
              value={settings.gitlab_account?.host ?? "https://gitlab.com"}
              onChange={(e) => updateGitLab({ host: e.target.value })}
            />
          </Field>
          <Field label={t("settings.username")}>
            <Input
              value={settings.gitlab_account?.username ?? ""}
              onChange={(e) => updateGitLab({ username: e.target.value })}
            />
          </Field>
          <Field label={t("settings.token")}>
            <Input
              type="password"
              value={settings.gitlab_account?.token ?? ""}
              onChange={(e) => updateGitLab({ token: e.target.value })}
            />
          </Field>
          <Button onClick={() => void verifyGitLab()}>{t("settings.verifyGitlab")}</Button>
        </Section>

        <Section title={t("settings.appearance")}>
          <Field label={t("settings.theme")}>
            <select
              className="jb-input"
              value={settings.ui_theme}
              onChange={(e) => previewUiPreference({ ui_theme: e.target.value as UiTheme })}
            >
              <option value="dark">{t("settings.themeDark")}</option>
              <option value="light">{t("settings.themeLight")}</option>
            </select>
          </Field>
          <Field label={t("settings.language")}>
            <select
              className="jb-input"
              value={settings.ui_language}
              onChange={(e) => previewUiPreference({ ui_language: e.target.value as UiLanguage })}
            >
              <option value="en">{t("settings.languageEn")}</option>
              <option value="zh">{t("settings.languageZh")}</option>
            </select>
          </Field>
          <label className="mb-3 flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={settings.store_settings_in_project}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  store_settings_in_project: e.target.checked,
                }))
              }
            />
            {t("settings.storeInAppData")}
          </label>
          <Field label={t("settings.diffMode")}>
            <select
              className="jb-input"
              value={settings.diff_mode}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  diff_mode: e.target.value as "unified" | "split",
                }))
              }
            >
              <option value="unified">{t("settings.diffUnified")}</option>
              <option value="split">{t("settings.diffSplit")}</option>
            </select>
          </Field>
        </Section>

        {verifyMsg && <div className="mb-4 text-xs jb-text-dim">{verifyMsg}</div>}

        <Button variant="primary" onClick={() => void save()}>
          {saved ? t("common.saved") : t("common.save")}
        </Button>

        <div className="jb-border-t mt-12 pt-6 text-xs jb-text-dim">
          <p>{t("settings.version")}</p>
        </div>
      </div>
    </div>
  );
}
