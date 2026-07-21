import type { ReactNode } from "react";
import { cn } from "../../lib/utils";
import type { FileStatusKind } from "../../lib/types";
import { statusBadge } from "../../lib/utils";

type BadgeTone = "warning" | "info" | "success" | "error" | "neutral";

const TONE_CLASS: Record<BadgeTone, string> = {
  warning: "jb-badge jb-badge-warning",
  info: "jb-badge jb-badge-info",
  success: "jb-badge jb-badge-success",
  error: "jb-badge jb-badge-error",
  neutral: "jb-badge jb-badge-neutral",
};

export function Badge({
  tone = "warning",
  className,
  children,
}: {
  tone?: BadgeTone;
  className?: string;
  children: ReactNode;
}) {
  return <span className={cn(TONE_CLASS[tone], className)}>{children}</span>;
}

export function StatusDot({ status, className }: { status: FileStatusKind; className?: string }) {
  const { label, className: colorClass } = statusBadge(status);
  return (
    <span className={cn("font-mono text-xs", colorClass, className)} title={status}>
      {label}
    </span>
  );
}
