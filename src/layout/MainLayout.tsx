import { ActivityBar } from "../components/ActivityBar";
import { BottomToolWindow } from "../components/BottomToolWindow";
import { CommitToolWindow } from "../components/CommitToolWindow";
import { EditorArea } from "../components/EditorArea";
import { MainToolbar } from "../components/MainToolbar";
import { MergeRequestsPanel } from "../components/MergeRequestsPanel";
import { ProjectToolWindow } from "../components/ProjectToolWindow";
import { PullRequestsPanel } from "../components/PullRequestsPanel";
import { ResizableBottomPanel } from "../components/ResizableBottomPanel";
import { ResizableLeftPanel } from "../components/ResizableLeftPanel";
import { StatusBar } from "../components/StatusBar";
import { useAppStore } from "../store/appStore";

export function MainLayout() {
  const leftToolWindow = useAppStore((s) => s.leftToolWindow);
  const leftPanelVisible = useAppStore((s) => s.leftPanelVisible);
  const bottomExpanded = useAppStore((s) => s.bottomExpanded);

  return (
    <div className="jb-shell flex h-full min-h-0 flex-col">
      <MainToolbar />
      <div className="flex min-h-0 flex-1">
        <ActivityBar />
        <ResizableLeftPanel visible={leftPanelVisible}>
          {leftToolWindow === "project" && <ProjectToolWindow />}
          {leftToolWindow === "git" && <CommitToolWindow />}
          {leftToolWindow === "pullRequests" && <PullRequestsPanel />}
          {leftToolWindow === "mergeRequests" && <MergeRequestsPanel />}
        </ResizableLeftPanel>
        <EditorArea />
      </div>
      {bottomExpanded && (
        <ResizableBottomPanel>
          <BottomToolWindow />
        </ResizableBottomPanel>
      )}
      <StatusBar />
    </div>
  );
}
