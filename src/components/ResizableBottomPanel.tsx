import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "../lib/utils";

const STORAGE_KEY = "rebased.bottomPanelHeight";
const STATUS_BAR_HEIGHT = 28;
const DEFAULT_HEIGHT = 192;
const MIN_HEIGHT = 120;
const MAX_HEIGHT_RATIO = 0.7;

function readStoredHeight(): number {
  if (typeof window === "undefined") return DEFAULT_HEIGHT;
  const raw = localStorage.getItem(STORAGE_KEY);
  const parsed = raw ? Number(raw) : DEFAULT_HEIGHT;
  if (!Number.isFinite(parsed)) return DEFAULT_HEIGHT;
  return Math.min(window.innerHeight * MAX_HEIGHT_RATIO, Math.max(MIN_HEIGHT, parsed));
}

export function ResizableBottomPanel({ children }: { children: ReactNode }) {
  const [height, setHeight] = useState(readStoredHeight);
  const [dragging, setDragging] = useState(false);
  const heightRef = useRef(height);
  heightRef.current = height;

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(height));
  }, [height]);

  const stopDragging = useCallback(() => {
    setDragging(false);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }, []);

  useEffect(() => {
    if (!dragging) return;

    const onMouseMove = (event: MouseEvent) => {
      const max = window.innerHeight * MAX_HEIGHT_RATIO;
      const next = window.innerHeight - STATUS_BAR_HEIGHT - event.clientY;
      setHeight(Math.min(max, Math.max(MIN_HEIGHT, next)));
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
    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";
  }, []);

  useEffect(() => {
    const onResize = () => {
      const max = window.innerHeight * MAX_HEIGHT_RATIO;
      if (heightRef.current > max) {
        setHeight(Math.max(MIN_HEIGHT, max));
      }
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <div className="jb-bottom-panel-wrap flex shrink-0 flex-col" style={{ height }}>
      <div
        role="separator"
        aria-orientation="horizontal"
        aria-valuenow={height}
        aria-valuemin={MIN_HEIGHT}
        className={cn(
          "jb-panel-resize-handle jb-panel-resize-handle-horizontal",
          dragging && "jb-panel-resize-handle-active",
        )}
        onMouseDown={onMouseDown}
      />
      <div className="jb-bottom-panel flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
