import type { ComponentType } from "react";
import { useAppStore } from "../store/appStore";
import type { LeftToolWindow } from "../lib/types";
import { useT } from "../context/PreferencesContext";
import { cn } from "../lib/utils";
import { GitIcon, IconButton, ProjectIcon, SearchIcon, type IconProps } from "./ui";

type SidebarTool = Extract<LeftToolWindow, "project" | "git" | "search">;

const TOOLS: ReadonlyArray<{
  id: SidebarTool;
  labelKey: "sidebar.project" | "sidebar.git" | "sidebar.search";
  icon: ComponentType<Omit<IconProps, "children">>;
}> = [
  { id: "project", labelKey: "sidebar.project", icon: ProjectIcon },
  { id: "git", labelKey: "sidebar.git", icon: GitIcon },
  { id: "search", labelKey: "sidebar.search", icon: SearchIcon },
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
          <IconButton
            key={id}
            surface="activity"
            label={t(labelKey)}
            data-testid={`activity-${id}`}
            className={cn(active && "jb-activity-btn-active")}
            aria-pressed={active}
            onClick={() => toggleLeftToolWindow(id)}
          >
            <Icon size="lg" />
          </IconButton>
        );
      })}
    </nav>
  );
}
