import type { ButtonHTMLAttributes, ReactNode, Ref } from "react";
import { cn } from "../../lib/utils";

export interface TreeRowProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className"> {
  depth?: number;
  indent?: number;
  padBase?: number;
  selected?: boolean;
  open?: boolean;
  className?: string;
  children: ReactNode;
  ref?: Ref<HTMLButtonElement>;
}

/** Dense tree row with depth-based indent. Domain chrome via className. */
export function TreeRow({
  depth = 0,
  indent = 14,
  padBase = 8,
  selected,
  open,
  className,
  style,
  type,
  children,
  ref,
  ...rest
}: TreeRowProps) {
  return (
    <button
      ref={ref}
      type={type ?? "button"}
      className={cn(
        "jb-tree-row",
        selected && "jb-tree-row-selected",
        open && "jb-tree-row-open",
        className,
      )}
      style={{ ...style, paddingLeft: `${depth * indent + padBase}px` }}
      {...rest}
    >
      {children}
    </button>
  );
}
