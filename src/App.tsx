import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { PreferencesProvider, useT } from "./context/PreferencesContext";
import { api } from "./lib/api";
import { useAutoFetch } from "./hooks/useAutoFetch";
import { useInvalidateRepo, useRepoChangedListener } from "./hooks/useRepo";
import { javaLspClient } from "./editor/lspClient";
import { MainLayout } from "./layout/MainLayout";
import { WelcomePage } from "./pages/WelcomePage";
import { UiDialogHost } from "./components/UiDialogHost";
import { useAppStore } from "./store/appStore";
import { invalidateLog } from "./lib/queryInvalidation";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 1000,
    },
  },
});

function MainApp() {
  const t = useT();
  const repo = useAppStore((s) => s.repo);
  const selectedRemote = useAppStore((s) => s.selectedRemote);
  const openLogEditor = useAppStore((s) => s.openLogEditor);
  const setCommitTwTab = useAppStore((s) => s.setCommitTwTab);
  const setLeftToolWindow = useAppStore((s) => s.setLeftToolWindow);
  const setBottomToolWindow = useAppStore((s) => s.setBottomToolWindow);
  const appendVcsOutput = useAppStore((s) => s.appendVcsOutput);
  const clearVcsOutput = useAppStore((s) => s.clearVcsOutput);
  const setJavaLspStatus = useAppStore((s) => s.setJavaLspStatus);
  const appendJavaLspLog = useAppStore((s) => s.appendJavaLspLog);
  const pushIdeNotification = useAppStore((s) => s.pushIdeNotification);
  const setIdeNotificationsOpen = useAppStore((s) => s.setIdeNotificationsOpen);
  const invalidate = useInvalidateRepo();
  const queryClient = useQueryClient();
  useRepoChangedListener();
  useAutoFetch();

  useEffect(() => {
    let lastError: string | null = null;
    let lastKey = "";
    let lastJobLabel: string | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let pending: {
      phase: string;
      sentinel: string | null;
      percent: number | null;
    } | null = null;

    const flush = () => {
      timer = null;
      if (!pending) return;
      const { phase, sentinel, percent } = pending;
      pending = null;
      const key = `${phase}|${sentinel ?? ""}|${percent ?? ""}`;
      if (key === lastKey) return;
      lastKey = key;
      setJavaLspStatus(
        phase as "idle" | "starting" | "installing" | "indexing" | "ready" | "error",
        sentinel,
        percent,
      );
      if (phase === "ready") {
        // Close out the progress line at 100% so we never show "20% → 就绪".
        const job =
          lastJobLabel ??
          t("fileEditor.lspLoadingCache");
        appendJavaLspLog(`${job} (100%)`);
        appendJavaLspLog(t("fileEditor.lspIndexReady"));
      } else if (sentinel) {
        lastJobLabel = sentinel;
        const hasPercent = /\d+\s*%/.test(sentinel);
        const line =
          percent != null && !hasPercent ? `${sentinel} (${percent}%)` : sentinel;
        appendJavaLspLog(line);
      }
    };

    const unsub = javaLspClient.subscribeProgress((progress) => {
      if (progress.phase === "idle") {
        lastKey = "";
        if (timer != null) clearTimeout(timer);
        timer = null;
        pending = null;
        setJavaLspStatus("idle", null, null);
        return;
      }
      const sentinel =
        progress.message === "loadingCachedIndex"
          ? t("fileEditor.lspLoadingCache")
          : progress.message === "buildingIndex"
            ? t("fileEditor.lspBuildingIndex")
            : progress.message === "updatingIndex"
              ? t("fileEditor.lspUpdatingIndex")
              : progress.message;
      if (progress.phase === "ready" || progress.phase === "error") {
        // Flush the last indexing tick first so the log can show (100%) before 就绪.
        if (timer != null) clearTimeout(timer);
        timer = null;
        if (pending && pending.phase !== "ready" && pending.phase !== "error") {
          flush();
        }
        pending = { phase: progress.phase, sentinel, percent: progress.percent };
        flush();
      } else {
        pending = { phase: progress.phase, sentinel, percent: progress.percent };
        if (timer == null) {
          // Keep synthetic index ticks snappy so the tip panel feels live.
          const synthetic =
            progress.message === "loadingCachedIndex" ||
            progress.message === "buildingIndex" ||
            progress.message === "updatingIndex";
          timer = setTimeout(flush, synthetic ? 50 : 200);
        }
      }
      if (progress.phase === "error" && progress.message && progress.message !== lastError) {
        lastError = progress.message;
        pushIdeNotification({
          level: "error",
          source: "Java LSP",
          title: t("fileEditor.lspUnavailable"),
          message: progress.message,
        });
        setIdeNotificationsOpen(true);
      }
    });

    return () => {
      if (timer != null) clearTimeout(timer);
      unsub();
    };
  }, [
    appendJavaLspLog,
    pushIdeNotification,
    setIdeNotificationsOpen,
    setJavaLspStatus,
    t,
  ]);

  useEffect(() => {
    const rootPath = repo?.path ?? null;
    if (!rootPath) {
      void javaLspClient.stop().catch(() => undefined);
      setJavaLspStatus("idle", null, null);
      return;
    }

    let cancelled = false;
    let idleId: number | null = null;
    // Let the shell settle first — JDT start on a multi-module Maven tree is very heavy.
    const timer = window.setTimeout(() => {
      const start = () => {
        void (async () => {
          try {
            const isJavaProject = await api.projectHasJavaMarkers().catch(() => false);
            if (cancelled || !isJavaProject) return;
            const existing = javaLspClient.getProgress();
            if (
              existing.phase !== "idle" &&
              (javaLspClient.isReady() || javaLspClient.isStarting())
            ) {
              setJavaLspStatus(existing.phase, existing.message, existing.percent);
            }
            await javaLspClient.warmStart(rootPath);
          } catch {
            // Progress/error UI is handled by subscribeProgress.
          }
        })();
      };
      const ric = (
        window as Window & {
          requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
        }
      ).requestIdleCallback;
      if (typeof ric === "function") {
        idleId = ric(start, { timeout: 8000 });
      } else {
        start();
      }
    }, 18000);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      if (idleId != null) {
        const cic = (
          window as Window & { cancelIdleCallback?: (id: number) => void }
        ).cancelIdleCallback;
        cic?.(idleId);
      }
    };
  }, [repo?.path, setJavaLspStatus]);

  useEffect(() => {
    async function runRemote(label: string, action: () => Promise<{ output: string }>) {
      clearVcsOutput();
      setBottomToolWindow("vcsConsole");
      try {
        const r = await action();
        appendVcsOutput(r.output || label);
        await invalidate();
        await invalidateLog(queryClient);
      } catch (err) {
        appendVcsOutput(String(err));
      }
    }

    function onKeyDown(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (!repo) return;

      if (mod && e.key === "t" && !e.shiftKey) {
        e.preventDefault();
        void runRemote(t("app.pullCompleted"), () => api.gitPull(selectedRemote, repo.branch));
      } else if (mod && e.shiftKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        void runRemote(t("app.pushCompleted"), () => api.gitPush(selectedRemote, repo.branch));
      } else if (mod && e.key === "k" && !e.shiftKey) {
        e.preventDefault();
        setLeftToolWindow("git");
        setCommitTwTab("local");
        window.dispatchEvent(new Event("rebased:focus-commit"));
      } else if (mod && e.shiftKey && e.key.toLowerCase() === "f") {
        e.preventDefault();
        setLeftToolWindow("search");
      } else if (e.metaKey && e.altKey && e.key.toLowerCase() === "g") {
        e.preventDefault();
        openLogEditor();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    repo,
    selectedRemote,
    openLogEditor,
    setCommitTwTab,
    setLeftToolWindow,
    setBottomToolWindow,
    appendVcsOutput,
    clearVcsOutput,
    invalidate,
    queryClient,
    t,
  ]);

  if (!repo) {
    return <WelcomePage />;
  }

  return <MainLayout />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <PreferencesProvider>
        <div className="jb-shell h-screen">
          <MainApp />
          <UiDialogHost />
        </div>
      </PreferencesProvider>
    </QueryClientProvider>
  );
}
