import { useState, type CSSProperties, type ReactNode, type Ref } from "react";
import { cn } from "../../lib/utils";
import { ChevronRightIcon } from "./icons";

export function ContextMenu({
  className,
  style,
  children,
  menuRef,
}: {
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
  menuRef?: Ref<HTMLDivElement>;
}) {
  return (
    <div ref={menuRef} className={cn("jb-context-menu", className)} style={style} role="menu">
      {children}
    </div>
  );
}

export function ContextMenuItem({
  label,
  disabled,
  shortcut,
  danger,
  onClick,
}: {
  label: ReactNode;
  disabled?: boolean;
  shortcut?: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      className={cn("jb-context-menu-item", danger && "jb-context-menu-item-danger")}
      disabled={disabled}
      onClick={onClick}
    >
      <span className="jb-context-menu-label">{label}</span>
      {shortcut && <span className="jb-context-menu-shortcut">{shortcut}</span>}
    </button>
  );
}

export function ContextMenuSeparator() {
  return <div className="jb-context-menu-separator" role="separator" />;
}

export function ContextMenuSubmenu({
  label,
  disabled,
  children,
}: {
  label: ReactNode;
  disabled?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className={cn("jb-context-menu-submenu-wrap", disabled && "opacity-45")}
      onMouseEnter={() => {
        if (!disabled) setOpen(true);
      }}
      onMouseLeave={() => setOpen(false)}
    >
      <button type="button" className="jb-context-menu-item" disabled={disabled}>
        <span className="jb-context-menu-label">{label}</span>
        <ChevronRightIcon size="xs" className="jb-context-menu-chevron" />
      </button>
      {open && !disabled && (
        <div className="jb-context-menu jb-context-menu-flyout">{children}</div>
      )}
    </div>
  );
}
