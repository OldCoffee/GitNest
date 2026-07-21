import type { ReactNode } from "react";
import { cn } from "../../lib/utils";
import { Panel, PanelBody } from "./Panel";
import { ToolWindowHeader } from "./ToolWindowHeader";

export interface ToolWindowShellProps {
  title: ReactNode;
  actions?: ReactNode;
  tabs?: ReactNode;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}

/** Standard left-tool-window layout: header + optional tabs + scroll body. */
export function ToolWindowShell({
  title,
  actions,
  tabs,
  className,
  bodyClassName,
  children,
}: ToolWindowShellProps) {
  return (
    <Panel className={className}>
      <ToolWindowHeader title={title} actions={actions} />
      {tabs}
      <PanelBody className={bodyClassName}>{children}</PanelBody>
    </Panel>
  );
}

export interface EditorTabShellProps {
  title?: ReactNode;
  toolbar?: ReactNode;
  scroll?: "page" | "fill";
  className?: string;
  children: ReactNode;
}

/** Editor-tab page shell for Settings / Branches style views. */
export function EditorTabShell({
  title,
  toolbar,
  scroll = "page",
  className,
  children,
}: EditorTabShellProps) {
  return (
    <div className={cn("jb-editor-tab-shell", className)}>
      {(title != null || toolbar != null) && (
        <div className="jb-page-header">
          {title != null && <h2 className="jb-page-title">{title}</h2>}
          {toolbar}
        </div>
      )}
      <div
        className={cn(
          "jb-editor-tab-shell-body",
          scroll === "fill" && "jb-editor-tab-shell-body-fill",
        )}
      >
        {children}
      </div>
    </div>
  );
}
