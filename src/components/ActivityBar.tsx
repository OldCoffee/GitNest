import type { ReactElement } from "react";
import { useAppStore } from "../store/appStore";
import type { LeftToolWindow } from "../lib/types";
import { useT } from "../context/PreferencesContext";
import { cn } from "../lib/utils";

type SidebarTool = Extract<LeftToolWindow, "project" | "git">;

function ProjectIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden>
      <path
        fill="currentColor"
        d="M2 4.5A1.5 1.5 0 0 1 3.5 3H6l1.2 1.2H12.5A1.5 1.5 0 0 1 14 5.7v6.8A1.5 1.5 0 0 1 12.5 14h-9A1.5 1.5 0 0 1 2 12.5v-8Z"
      />
    </svg>
  );
}

function GitIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden>
      <path
        fill="currentColor"
        d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13Zm0 1a5.5 5.5 0 1 1 0 11 5.5 5.5 0 0 1 0-11Zm-.75 2v2.19l1.72 1-.5.87L8 7.06 6.03 8.43l-.5-.87 1.72-1V4.5h1.5Z"
      />
    </svg>
  );
}

const TOOLS: ReadonlyArray<{
  id: SidebarTool;
  labelKey: "sidebar.project" | "sidebar.git";
  icon: () => ReactElement;
}> = [
  { id: "project", labelKey: "sidebar.project", icon: ProjectIcon },
  { id: "git", labelKey: "sidebar.git", icon: GitIcon },
];

export function ActivityBar() {
  const t = useT();
  const leftToolWindow = useAppStore((s) => s.leftToolWindow);
  const leftPanelVisible = useAppStore((s) => s.leftPanelVisible);
  const toggleLeftToolWindow = useAppStore((s) => s.toggleLeftToolWindow);

  return (
    <nav className="jb-activity-bar" aria-label={t("sidebar.ariaLabel")}>
      {TOOLS.map(({ id, labelKey, icon: Icon }) => {
        const active = leftPanelVisible && leftToolWindow === id;
        return (
          <button
            key={id}
            type="button"
            className={cn("jb-activity-btn", active && "jb-activity-btn-active")}
            title={t(labelKey)}
            aria-label={t(labelKey)}
            aria-pressed={active}
            onClick={() => toggleLeftToolWindow(id)}
          >
            <Icon />
          </button>
        );
      })}
    </nav>
  );
}
