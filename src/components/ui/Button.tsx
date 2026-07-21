import type { ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

type Variant =
  | "toolbar"
  | "toolbarIcon"
  | "toolbarRepo"
  | "action"
  | "primary"
  | "icon"
  | "ghost"
  | "danger"
  | "status"
  | "statusLsp";
type Size = "sm" | "md";

const VARIANT_CLASS: Record<Variant, string> = {
  toolbar: "jb-toolbar-btn",
  toolbarIcon: "jb-toolbar-icon-btn",
  toolbarRepo: "jb-toolbar-repo",
  action: "jb-action-btn",
  primary: "jb-btn-primary",
  icon: "jb-icon-btn",
  ghost: "jb-ghost-btn",
  danger: "jb-btn-danger",
  status: "jb-status-toggle",
  statusLsp: "jb-status-lsp",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export function Button({
  variant = "action",
  size = "md",
  loading = false,
  className,
  type,
  disabled,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type ?? "button"}
      className={cn(
        VARIANT_CLASS[variant],
        size === "sm" && "text-[11px] py-0.5 px-2",
        className,
      )}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? "…" : children}
    </button>
  );
}
