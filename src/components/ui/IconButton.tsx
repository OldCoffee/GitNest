import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/utils";

type Size = "sm" | "md" | "lg";
type Surface =
  | "default"
  | "activity"
  | "project"
  | "branchTool"
  | "terminalAdd"
  | "tabClose"
  | "treeAction";

const SIZE_CLASS: Record<Size, string> = {
  sm: "jb-icon-btn-sm",
  md: "jb-icon-btn-md",
  lg: "jb-icon-btn-lg",
};

const SURFACE_CLASS: Record<Surface, string> = {
  default: "jb-icon-btn",
  activity: "jb-activity-btn",
  project: "jb-project-toolbar-btn",
  branchTool: "jb-branch-popup-tool",
  terminalAdd: "jb-terminal-add",
  tabClose: "jb-tab-close",
  treeAction: "jb-tree-action-btn",
};

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  size?: Size;
  /** Chrome surface — domain CSS instead of generic icon button. */
  surface?: Surface;
  label: string;
  children: ReactNode;
}

/** Icon-only control with required accessible name. */
export function IconButton({
  size = "md",
  surface = "default",
  label,
  className,
  type,
  children,
  title,
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type ?? "button"}
      className={cn(
        SURFACE_CLASS[surface],
        surface === "default" && SIZE_CLASS[size],
        className,
      )}
      aria-label={label}
      title={title ?? label}
      {...rest}
    >
      {children}
    </button>
  );
}
