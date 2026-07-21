import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "../lib/utils";
import { ChevronDownIcon } from "./ui";

interface LogFilterDropdownProps {
  label: string;
  value: string;
  active?: boolean;
  width?: number;
  children: (close: () => void) => ReactNode;
}

export function LogFilterDropdown({
  label,
  value,
  active,
  width = 240,
  children,
}: LogFilterDropdownProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const left = Math.min(rect.left, window.innerWidth - width - 8);
    setPos({ top: rect.bottom + 4, left: Math.max(8, left) });
  }, [open, width]);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      const target = e.target as Node;
      if (
        panelRef.current?.contains(target) ||
        triggerRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={cn("jb-log-filter-chip", (active || open) && "jb-log-filter-chip-active")}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="jb-log-filter-label">{label}:</span>
        <span className="jb-log-filter-value">{value}</span>
        <span className="jb-log-filter-caret">
          <ChevronDownIcon size="xs" />
        </span>
      </button>
      {open &&
        createPortal(
          <div
            ref={panelRef}
            className="jb-log-filter-panel"
            style={{ top: pos.top, left: pos.left, width }}
          >
            {children(close)}
          </div>,
          document.body,
        )}
    </>
  );
}
