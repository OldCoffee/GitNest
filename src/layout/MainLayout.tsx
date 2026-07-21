import { useEffect, useState } from "react";
import { ActivityBar } from "../components/ActivityBar";
import { BottomToolWindow } from "../components/BottomToolWindow";
import { CommitToolWindow } from "../components/CommitToolWindow";
import { EditorArea } from "../components/EditorArea";
import { MainToolbar } from "../components/MainToolbar";
import {
  NavigationPalette,
  type NavigationMode,
} from "../components/NavigationPalette";
import { ProjectToolWindow } from "../components/ProjectToolWindow";
import { ResizableBottomPanel } from "../components/ResizableBottomPanel";
import { ResizableLeftPanel } from "../components/ResizableLeftPanel";
import { SearchToolWindow } from "../components/SearchToolWindow";
import { StatusBar } from "../components/StatusBar";
import { Loading } from "../components/ui";
import { useT } from "../context/PreferencesContext";
import { useAppStore } from "../store/appStore";

export function MainLayout() {
  const t = useT();
  const leftToolWindow = useAppStore((s) => s.leftToolWindow);
  const leftPanelVisible = useAppStore((s) => s.leftPanelVisible);
  const bottomExpanded = useAppStore((s) => s.bottomExpanded);
  const [navMode, setNavMode] = useState<NavigationMode | null>(null);
  // Project mounts immediately; defer heavier Git panel a tick.
  const [heavyReady, setHeavyReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let idleId: number | null = null;
    const timeoutId = window.setTimeout(() => {
      const finish = () => {
        if (!cancelled) setHeavyReady(true);
      };
      const ric = (
        window as Window & {
          requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
        }
      ).requestIdleCallback;
      if (typeof ric === "function") {
        idleId = ric(finish, { timeout: 800 });
      } else {
        finish();
      }
    }, 120);
    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
      if (idleId != null) {
        (
          window as Window & { cancelIdleCallback?: (id: number) => void }
        ).cancelIdleCallback?.(idleId);
      }
    };
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.shiftKey && e.key.toLowerCase() === "o") {
        e.preventDefault();
        setNavMode("file");
      } else if (mod && e.key.toLowerCase() === "e" && !e.shiftKey) {
        e.preventDefault();
        setNavMode("recent");
      } else if (mod && e.key.toLowerCase() === "g" && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        setNavMode("line");
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="jb-shell flex h-full min-h-0 flex-col">
      <MainToolbar />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <ActivityBar />
        <ResizableLeftPanel visible={leftPanelVisible}>
          {leftToolWindow === "project" && <ProjectToolWindow />}
          {leftToolWindow === "git" &&
            (heavyReady ? (
              <CommitToolWindow />
            ) : (
              <Loading className="p-3 text-xs">{t("common.loading")}</Loading>
            ))}
          {leftToolWindow === "search" && <SearchToolWindow />}
        </ResizableLeftPanel>
        <EditorArea />
      </div>
      {bottomExpanded && (
        <ResizableBottomPanel>
          <BottomToolWindow />
        </ResizableBottomPanel>
      )}
      <StatusBar />
      {navMode && <NavigationPalette mode={navMode} onClose={() => setNavMode(null)} />}
    </div>
  );
}
