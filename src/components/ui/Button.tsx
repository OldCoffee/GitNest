import type { ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

type Variant = "toolbar" | "toolbarIcon" | "action" | "primary" | "icon" | "ghost";

const VARIANT_CLASS: Record<Variant, string> = {
  toolbar: "jb-toolbar-btn",
  toolbarIcon: "jb-toolbar-icon-btn",
  action: "jb-action-btn",
  primary: "jb-btn-primary",
  icon: "jb-icon-btn",
  ghost: "jb-ghost-btn",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export function Button({ variant = "action", className, type, ...rest }: ButtonProps) {
  return (
    <button
      type={type ?? "button"}
      className={cn(VARIANT_CLASS[variant], className)}
      {...rest}
    />
  );
}
