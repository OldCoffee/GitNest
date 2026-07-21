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

type AlertLevel = "error" | "warning" | "info";

export function InlineAlert({
  level = "info",
  className,
  children,
}: {
  level?: AlertLevel;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "jb-alert",
        level === "error" && "jb-alert-error",
        level === "warning" && "jb-alert-warning",
        level === "info" && "jb-alert-info",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function AsyncState({
  loading,
  empty,
  error,
  children,
}: {
  loading?: boolean;
  empty?: ReactNode;
  error?: ReactNode;
  children: ReactNode;
}) {
  if (loading) return <Loading />;
  if (error) return <InlineAlert level="error">{error}</InlineAlert>;
  if (empty) return <EmptyState>{empty}</EmptyState>;
  return <>{children}</>;
}
