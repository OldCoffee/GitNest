import { useEffect, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { open } from "@tauri-apps/plugin-dialog";
import { api } from "../lib/api";
import type { AppSettings } from "../lib/types";
import { useSettings } from "../hooks/useRepo";
import { useAppStore } from "../store/appStore";
import { Button, Input, Select, Checkbox, ConfirmDialog, EditorTabShell, FormField } from "../components/ui";
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
  store_settings_in_project: false,
  confirm_discard: true,
  ui_theme: "dark",
  ui_language: "en",
  java_home: "",
  jdt_ls_path: "",
  maven_home: "",
};

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="jb-page-section">
      <h3 className="jb-page-section-title">{title}</h3>
      <div className="jb-page-section-body">{children}</div>
    </section>
  );
}

export function SettingsPage() {
  const t = useT();
  const { data: loaded } = useSettings();
  const queryClient = useQueryClient();
  const repo = useAppStore((s) => s.repo);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState(false);
  const [newRemoteName, setNewRemoteName] = useState("");
  const [newRemoteUrl, setNewRemoteUrl] = useState("");
  const [pendingRemoveRemote, setPendingRemoveRemote] = useState<string | null>(null);

  const { data: remotes = [], refetch: refetchRemotes } = useQuery({
    queryKey: ["remotes"],
    queryFn: api.getRemotes,
    enabled: !!repo,
  });

  useEffect(() => {
    if (loaded) setSettings(loaded);
  }, [loaded]);

  const { data: detectedJava } = useQuery({
    queryKey: ["detect-java-runtime"],
    queryFn: api.detectJavaRuntime,
    staleTime: 60_000,
  });

  const { data: detectedJdtLs } = useQuery({
    queryKey: ["detect-jdt-ls"],
    queryFn: api.detectJdtLs,
    staleTime: 60_000,
  });

  const { data: detectedMaven } = useQuery({
    queryKey: ["detect-maven-runtime"],
    queryFn: api.detectMavenRuntime,
    staleTime: 60_000,
  });

  const useManualJdk = settings.java_home.trim().length > 0;
  const useManualMaven = settings.maven_home.trim().length > 0;

  async function pickJdkHome() {
    const selected = await open({ directory: true, multiple: false });
    if (typeof selected === "string") {
      setSettings((s) => ({ ...s, java_home: selected }));
    }
  }

  async function pickJdtLsPath() {
    const selected = await open({ directory: true, multiple: false });
    if (typeof selected === "string") {
      setSettings((s) => ({ ...s, jdt_ls_path: selected }));
    }
  }

  async function pickMavenHome() {
    const selected = await open({ directory: true, multiple: false });
    if (typeof selected === "string") {
      setSettings((s) => ({ ...s, maven_home: selected }));
    }
  }

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

  return (
    <EditorTabShell title={t("settings.title")}>
      <div className="jb-page">
      <div className="mx-auto max-w-2xl">
        <Section title={t("settings.git")}>
          <FormField label={t("settings.gitPath")}>
            <Input
              value={settings.git_path}
              onChange={(e) =>
                setSettings((s) => ({ ...s, git_path: e.target.value }))
              }
            />
          </FormField>
          <FormField label={t("settings.defaultRemote")}>
            <Input
              value={settings.default_remote}
              onChange={(e) =>
                setSettings((s) => ({ ...s, default_remote: e.target.value }))
              }
            />
          </FormField>
          <FormField label={t("settings.autoFetch")}>
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
          </FormField>
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
                  onClick={() => setPendingRemoveRemote(remote.name)}
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
          <Checkbox
            label={t("settings.confirmDiscard")}
            checked={settings.confirm_discard}
            onChange={(e) =>
              setSettings((s) => ({ ...s, confirm_discard: e.target.checked }))
            }
          />
        </Section>

        <Section title={t("settings.logSection")}>
          <p className="text-xs jb-text-dim">{t("settings.logHint")}</p>
        </Section>

        <Section title={t("settings.terminalSection")}>
          <FormField label={t("settings.shellPath")}>
            <Input
              value={settings.shell_path}
              onChange={(e) =>
                setSettings((s) => ({ ...s, shell_path: e.target.value }))
              }
            />
          </FormField>
        </Section>

        <Section title={t("settings.javaSection")}>
          <FormField label={t("settings.javaHome")}>
            <div className="mt-1 space-y-2">
              <label className="flex items-start gap-2 text-xs jb-text">
                <input
                  type="radio"
                  className="mt-0.5"
                  name="java-jdk-mode"
                  checked={!useManualJdk}
                  onChange={() => setSettings((s) => ({ ...s, java_home: "" }))}
                />
                <span className="min-w-0">
                  <span className="block">{t("settings.javaHomeDefault")}</span>
                  {detectedJava?.home ? (
                    <span className="mt-0.5 block jb-text-dim">
                      {t("settings.javaHomeDetected", { home: detectedJava.home })}
                      {detectedJava.version
                        ? ` · ${t("settings.javaHomeVersion", { version: detectedJava.version })}`
                        : null}
                    </span>
                  ) : (
                    <span className="mt-0.5 block jb-text-dim">
                      {t("settings.javaHomeNotFound")}
                    </span>
                  )}
                </span>
              </label>
              <label className="flex items-start gap-2 text-xs jb-text">
                <input
                  type="radio"
                  className="mt-0.5"
                  name="java-jdk-mode"
                  checked={useManualJdk}
                  onChange={() =>
                    setSettings((s) => ({
                      ...s,
                      java_home: s.java_home.trim() || detectedJava?.home || "",
                    }))
                  }
                />
                <span className="block">{t("settings.javaHomeManual")}</span>
              </label>
              {useManualJdk ? (
                <div className="flex gap-2 pl-5">
                  <Input
                    className="flex-1"
                    value={settings.java_home}
                    placeholder={t("settings.javaHomePlaceholder")}
                    onChange={(e) =>
                      setSettings((s) => ({ ...s, java_home: e.target.value }))
                    }
                  />
                  <Button type="button" onClick={() => void pickJdkHome()}>
                    {t("settings.javaHomeBrowse")}
                  </Button>
                </div>
              ) : null}
            </div>
          </FormField>
          <FormField label={t("settings.mavenHome")}>
            <div className="mt-1 space-y-2">
              <label className="flex items-start gap-2 text-xs jb-text">
                <input
                  type="radio"
                  className="mt-0.5"
                  name="java-maven-mode"
                  checked={!useManualMaven}
                  onChange={() => setSettings((s) => ({ ...s, maven_home: "" }))}
                />
                <span className="min-w-0">
                  <span className="block">{t("settings.mavenHomeDefault")}</span>
                  {detectedMaven?.home ? (
                    <span className="mt-0.5 block jb-text-dim">
                      {t("settings.mavenHomeDetected", { home: detectedMaven.home })}
                      {detectedMaven.version
                        ? ` · ${t("settings.mavenHomeVersion", { version: detectedMaven.version })}`
                        : null}
                    </span>
                  ) : (
                    <span className="mt-0.5 block jb-text-dim">
                      {t("settings.mavenHomeNotFound")}
                    </span>
                  )}
                </span>
              </label>
              <label className="flex items-start gap-2 text-xs jb-text">
                <input
                  type="radio"
                  className="mt-0.5"
                  name="java-maven-mode"
                  checked={useManualMaven}
                  onChange={() =>
                    setSettings((s) => ({
                      ...s,
                      maven_home: s.maven_home.trim() || detectedMaven?.home || "",
                    }))
                  }
                />
                <span className="block">{t("settings.mavenHomeManual")}</span>
              </label>
              {useManualMaven ? (
                <div className="flex gap-2 pl-5">
                  <Input
                    className="flex-1"
                    value={settings.maven_home}
                    placeholder={t("settings.mavenHomePlaceholder")}
                    onChange={(e) =>
                      setSettings((s) => ({ ...s, maven_home: e.target.value }))
                    }
                  />
                  <Button type="button" onClick={() => void pickMavenHome()}>
                    {t("settings.mavenHomeBrowse")}
                  </Button>
                </div>
              ) : null}
              <p className="text-xs jb-text-dim">{t("settings.mavenHomeHint")}</p>
            </div>
          </FormField>
          <FormField label={t("settings.jdtLsPath")}>
            <div className="mt-1 space-y-2">
              <div className="flex gap-2">
                <Input
                  className="flex-1"
                  value={settings.jdt_ls_path}
                  placeholder={t("settings.jdtLsPathPlaceholder")}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, jdt_ls_path: e.target.value }))
                  }
                />
                <Button type="button" onClick={() => void pickJdtLsPath()}>
                  {t("settings.jdtLsBrowse")}
                </Button>
              </div>
              {settings.jdt_ls_path.trim() ? null : detectedJdtLs?.valid && detectedJdtLs.path ? (
                <p className="text-xs jb-text-dim">
                  {t("settings.jdtLsManaged", { path: detectedJdtLs.path })}
                </p>
              ) : settings.jdt_ls_path.trim() ? null : (
                <p className="text-xs jb-text-dim">{t("settings.jdtLsNeedsInstall")}</p>
              )}
              <p className="text-xs jb-text-dim">{t("settings.jdtLsHint")}</p>
            </div>
          </FormField>
        </Section>

        <Section title={t("settings.appearance")}>
          <FormField label={t("settings.theme")}>
            <Select
              value={settings.ui_theme}
              onChange={(e) => previewUiPreference({ ui_theme: e.target.value as UiTheme })}
            >
              <option value="dark">{t("settings.themeDark")}</option>
              <option value="light">{t("settings.themeLight")}</option>
            </Select>
          </FormField>
          <FormField label={t("settings.language")}>
            <Select
              value={settings.ui_language}
              onChange={(e) => previewUiPreference({ ui_language: e.target.value as UiLanguage })}
            >
              <option value="en">{t("settings.languageEn")}</option>
              <option value="zh">{t("settings.languageZh")}</option>
            </Select>
          </FormField>
          <Checkbox
            className="mb-3"
            label={t("settings.storeInAppData")}
            checked={settings.store_settings_in_project}
            onChange={(e) =>
              setSettings((s) => ({
                ...s,
                store_settings_in_project: e.target.checked,
              }))
            }
          />
          <FormField label={t("settings.diffMode")}>
            <Select
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
            </Select>
          </FormField>
        </Section>

        <div className="jb-page-footer">
          <p className="jb-page-footer-meta">{t("settings.version")}</p>
          <Button variant="primary" onClick={() => void save()}>
            {saved ? t("common.saved") : t("common.save")}
          </Button>
        </div>
      </div>
      </div>
      {pendingRemoveRemote && (
        <ConfirmDialog
          danger
          message={t("settings.removeRemoteConfirm", { name: pendingRemoveRemote })}
          onConfirm={() => {
            const name = pendingRemoveRemote;
            setPendingRemoveRemote(null);
            void api.gitRemoveRemote(name).then(() => refetchRemotes());
          }}
          onCancel={() => setPendingRemoveRemote(null)}
        />
      )}
    </EditorTabShell>
  );
}
