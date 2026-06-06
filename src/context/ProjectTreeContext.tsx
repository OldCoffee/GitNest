import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAppStore } from "../store/appStore";

type ExpandMode = "all" | "none" | null;

interface ProjectTreeContextValue {
  expandMode: ExpandMode;
  forceExpandedPaths: ReadonlySet<string>;
  collapsedInAllMode: ReadonlySet<string>;
  selectedPath: string | null;
  locateSeq: number;
  isExpanded: (path: string, isDir: boolean) => boolean;
  setExpanded: (path: string, expanded: boolean) => void;
  toggleFolderInAllMode: (path: string) => void;
  expandAll: () => void;
  collapseAll: () => void;
  locateActiveFile: () => void;
  registerRow: (path: string, node: HTMLButtonElement | null) => void;
}

const ProjectTreeContext = createContext<ProjectTreeContextValue | null>(null);

function ancestorPaths(filePath: string): string[] {
  const parts = filePath.split("/").filter(Boolean);
  if (parts.length <= 1) return [];
  const paths: string[] = [];
  for (let i = 0; i < parts.length - 1; i++) {
    paths.push(parts.slice(0, i + 1).join("/"));
  }
  return paths;
}

function activeEditorFilePath(): string | null {
  const { editorTabs, activeEditorTabId } = useAppStore.getState();
  const tab = editorTabs.find((t) => t.id === activeEditorTabId);
  if (tab?.kind === "diff" && tab.diff?.path) return tab.diff.path;
  return null;
}

export function ProjectTreeProvider({ children }: { children: ReactNode }) {
  const [expandMode, setExpandMode] = useState<ExpandMode>(null);
  const [forceExpandedPaths, setForceExpandedPaths] = useState<Set<string>>(new Set());
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [locateSeq, setLocateSeq] = useState(0);
  const [localExpanded, setLocalExpanded] = useState<Map<string, boolean>>(new Map());
  const [collapsedInAllMode, setCollapsedInAllMode] = useState<Set<string>>(new Set());
  const rowRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const scrollTarget = useRef<string | null>(null);
  const expandModeRef = useRef(expandMode);
  expandModeRef.current = expandMode;

  const scrollToPath = useCallback((path: string) => {
    requestAnimationFrame(() => {
      rowRefs.current.get(path)?.scrollIntoView({ block: "nearest" });
    });
  }, []);

  const expandAll = useCallback(() => {
    setExpandMode("all");
    setForceExpandedPaths(new Set());
    setCollapsedInAllMode(new Set());
    setSelectedPath(null);
  }, []);

  const collapseAll = useCallback(() => {
    setExpandMode("none");
    setForceExpandedPaths(new Set());
    setCollapsedInAllMode(new Set());
    setSelectedPath(null);
  }, []);

  const locateActiveFile = useCallback(() => {
    const path = activeEditorFilePath();
    if (!path) return;
    if (expandModeRef.current !== "all") {
      setExpandMode(null);
      setForceExpandedPaths(new Set(ancestorPaths(path)));
    } else {
      setCollapsedInAllMode((prev) => {
        const next = new Set(prev);
        for (const ancestor of ancestorPaths(path)) {
          next.delete(ancestor);
        }
        return next;
      });
    }
    setSelectedPath(path);
    scrollTarget.current = path;
    setLocateSeq((n) => n + 1);
    scrollToPath(path);
  }, [scrollToPath]);

  const setExpanded = useCallback((path: string, expanded: boolean) => {
    setExpandMode(null);
    setCollapsedInAllMode(new Set());
    setLocalExpanded((prev) => {
      const next = new Map(prev);
      next.set(path, expanded);
      return next;
    });
  }, []);

  const toggleFolderInAllMode = useCallback((path: string) => {
    setCollapsedInAllMode((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const isExpanded = useCallback(
    (path: string, isDir: boolean) => {
      if (!isDir) return false;
      if (expandMode === "all") return !collapsedInAllMode.has(path);
      if (expandMode === "none") return false;
      if (forceExpandedPaths.has(path)) return true;
      return localExpanded.get(path) ?? false;
    },
    [expandMode, collapsedInAllMode, forceExpandedPaths, localExpanded],
  );

  const registerRow = useCallback(
    (path: string, node: HTMLButtonElement | null) => {
      if (node) {
        rowRefs.current.set(path, node);
        if (scrollTarget.current === path) {
          scrollTarget.current = null;
          scrollToPath(path);
        }
      } else {
        rowRefs.current.delete(path);
      }
    },
    [scrollToPath],
  );

  const value = useMemo(
    () => ({
      expandMode,
      forceExpandedPaths,
      collapsedInAllMode,
      selectedPath,
      locateSeq,
      isExpanded,
      setExpanded,
      toggleFolderInAllMode,
      expandAll,
      collapseAll,
      locateActiveFile,
      registerRow,
    }),
    [
      expandMode,
      forceExpandedPaths,
      collapsedInAllMode,
      selectedPath,
      locateSeq,
      isExpanded,
      setExpanded,
      toggleFolderInAllMode,
      expandAll,
      collapseAll,
      locateActiveFile,
      registerRow,
    ],
  );

  return (
    <ProjectTreeContext.Provider value={value}>{children}</ProjectTreeContext.Provider>
  );
}

export function useProjectTree() {
  const ctx = useContext(ProjectTreeContext);
  if (!ctx) throw new Error("useProjectTree must be used within ProjectTreeProvider");
  return ctx;
}
