import type { ReactNode } from "react";
import { cn } from "../../lib/utils";
import { useT } from "../../context/PreferencesContext";

export function EmptyState({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("jb-empty-state", className)}>{children}</div>;
}

export function Loading({ className, children }: { className?: string; children?: ReactNode }) {
  const t = useT();
  return <div className={cn("jb-loading", className)}>{children ?? t("common.loading")}</div>;
}
