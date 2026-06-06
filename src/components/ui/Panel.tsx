import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

export interface PanelProps {
  className?: string;
  children: ReactNode;
}

/** Vertical tool-window panel: header + scrollable body via children. */
export function Panel({ className, children }: PanelProps) {
  return <div className={cn("flex h-full min-h-0 flex-col", className)}>{children}</div>;
}

export interface PanelBodyProps {
  className?: string;
  children: ReactNode;
}

export function PanelBody({ className, children }: PanelBodyProps) {
  return <div className={cn("min-h-0 flex-1 overflow-auto", className)}>{children}</div>;
}

export interface ToolbarStripProps {
  className?: string;
  children: ReactNode;
}

export function ToolbarStrip({ className, children }: ToolbarStripProps) {
  return <div className={cn("jb-toolbar-strip", className)}>{children}</div>;
}
