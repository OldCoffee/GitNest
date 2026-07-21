import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "../lib/utils";

const STORAGE_KEY = "rebased.leftPanelWidth";
const ACTIVITY_BAR_WIDTH = 40;
const DEFAULT_WIDTH = 320;
const MIN_WIDTH = 220;
const MAX_WIDTH = 720;

function readStoredWidth(): number {
  if (typeof window === "undefined") return DEFAULT_WIDTH;
  const raw = localStorage.getItem(STORAGE_KEY);
  const parsed = raw ? Number(raw) : DEFAULT_WIDTH;
  if (!Number.isFinite(parsed)) return DEFAULT_WIDTH;
  return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, parsed));
}

export function ResizableLeftPanel({
  visible,
  children,
}: {
  visible: boolean;
  children: ReactNode;
}) {
  const [width, setWidth] = useState(readStoredWidth);
  const [dragging, setDragging] = useState(false);
  const widthRef = useRef(width);
  widthRef.current = width;

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(width));
  }, [width]);

  const stopDragging = useCallback(() => {
    setDragging(false);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }, []);

  useEffect(() => {
    if (!dragging) return;

    const onMouseMove = (event: MouseEvent) => {
      const max = Math.min(MAX_WIDTH, window.innerWidth - ACTIVITY_BAR_WIDTH - 320);
      const next = Math.min(max, Math.max(MIN_WIDTH, event.clientX - ACTIVITY_BAR_WIDTH));
      setWidth(next);
    };

    const onMouseUp = () => stopDragging();

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [dragging, stopDragging]);

  const onMouseDown = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    setDragging(true);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  useEffect(() => {
    const onResize = () => {
      const max = Math.min(MAX_WIDTH, window.innerWidth - ACTIVITY_BAR_WIDTH - 320);
      if (widthRef.current > max) {
        setWidth(Math.max(MIN_WIDTH, max));
      }
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  if (!visible) return null;

  return (
    <div className="jb-left-panel-wrap" style={{ width }}>
      <aside className="jb-left-panel flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {children}
      </aside>
      <div
        role="separator"
        aria-orientation="vertical"
        aria-valuenow={width}
        aria-valuemin={MIN_WIDTH}
        aria-valuemax={MAX_WIDTH}
        className={cn("jb-panel-resize-handle", dragging && "jb-panel-resize-handle-active")}
        onMouseDown={onMouseDown}
      />
    </div>
  );
}
