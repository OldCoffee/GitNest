import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import { PreferencesProvider, useT } from "./context/PreferencesContext";
import { api } from "./lib/api";
import { useRepoChangedListener } from "./hooks/useRepo";
import { MainLayout } from "./layout/MainLayout";
import { WelcomePage } from "./pages/WelcomePage";
import { useAppStore } from "./store/appStore";

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
  const appendVcsOutput = useAppStore((s) => s.appendVcsOutput);
  useRepoChangedListener();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (!repo) return;

      if (mod && e.key === "t" && !e.shiftKey) {
        e.preventDefault();
        void api
          .gitPull(selectedRemote, repo.branch)
          .then((r) => appendVcsOutput(r.output || t("app.pullCompleted")))
          .catch((err) => appendVcsOutput(String(err)));
      } else if (mod && e.shiftKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        void api
          .gitPush(selectedRemote, repo.branch)
          .then((r) => appendVcsOutput(r.output || t("app.pushCompleted")))
          .catch((err) => appendVcsOutput(String(err)));
      } else if (mod && e.key === "k" && !e.shiftKey) {
        e.preventDefault();
        setLeftToolWindow("git");
        setCommitTwTab("local");
        window.dispatchEvent(new Event("rebased:focus-commit"));
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
    appendVcsOutput,
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
        </div>
      </PreferencesProvider>
    </QueryClientProvider>
  );
}
