import type { ReactNode } from "react";
import { cn } from "../../lib/utils";
import type { FileStatusKind } from "../../lib/types";
import { statusBadge } from "../../lib/utils";

export function Badge({ className, children }: { className?: string; children: ReactNode }) {
  return <span className={cn("jb-badge-warning", className)}>{children}</span>;
}

export function StatusDot({ status, className }: { status: FileStatusKind; className?: string }) {
  const { label, className: colorClass } = statusBadge(status);
  return (
    <span className={cn("font-mono text-xs", colorClass, className)} title={status}>
      {label}
    </span>
  );
}
