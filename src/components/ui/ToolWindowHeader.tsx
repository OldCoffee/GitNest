import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

export interface ToolWindowHeaderProps {
  title: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function ToolWindowHeader({ title, actions, className }: ToolWindowHeaderProps) {
  return (
    <div className={cn("jb-tw-header", className)}>
      <span className="truncate">{title}</span>
      {actions != null && <span className="flex items-center gap-1">{actions}</span>}
    </div>
  );
}
