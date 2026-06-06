import { create } from "zustand";
import type {
  BottomToolWindow,
  CommitTwTab,
  EditorTab,
  LeftToolWindow,
  ProjectClipboard,
  RepoInfo,
} from "../lib/types";
import {
  isEditorTabClosable,
  pickActiveAfterClose,
  sortEditorTabsPinnedFirst,
} from "../lib/editorTabPaths";

interface AppStore {
  repo: RepoInfo | null;
  leftToolWindow: LeftToolWindow;
  leftPanelVisible: boolean;
  commitTwTab: CommitTwTab;
  bottomToolWindow: BottomToolWindow;
  bottomExpanded: boolean;
  editorTabs: EditorTab[];
  activeEditorTabId: string | null;
  vcsConsoleOutput: string;
  selectedRemote: string;
  projectClipboard: ProjectClipboard | null;
  projectImportTarget: string | null;
  setRepo: (repo: RepoInfo | null) => void;
  setLeftToolWindow: (w: LeftToolWindow) => void;
  toggleLeftToolWindow: (w: LeftToolWindow) => void;
  setLeftPanelVisible: (visible: boolean) => void;
  setCommitTwTab: (tab: CommitTwTab) => void;
  setBottomToolWindow: (w: Exclude<BottomToolWindow, null>) => void;
  toggleBottomToolWindow: (w: Exclude<BottomToolWindow, null>) => void;
  openEditorTab: (tab: EditorTab) => void;
  closeEditorTab: (id: string) => void;
  closeOtherEditorTabs: (id: string) => void;
  closeAllEditorTabs: () => void;
  closeUnmodifiedEditorTabs: () => void;
  closeEditorTabsToLeft: (id: string) => void;
  closeEditorTabsToRight: (id: string) => void;
  pinEditorTab: (id: string, pinned: boolean) => void;
  setActiveEditorTab: (id: string | null) => void;
  openDiffEditor: (diff: import("../lib/types").DiffTab) => void;
  openFileEditor: (path: string) => void;
  openLogEditor: () => void;
  openSettingsEditor: () => void;
  openBranchesEditor: () => void;
  appendVcsOutput: (text: string) => void;
  clearVcsOutput: () => void;
  setSelectedRemote: (name: string) => void;
  setProjectClipboard: (clip: ProjectClipboard | null) => void;
  setProjectImportTarget: (path: string | null) => void;
  resetWorkspace: () => void;
}

export const useAppStore = create<AppStore>((set, get) => ({
  repo: null,
  leftToolWindow: "git",
  leftPanelVisible: true,
  commitTwTab: "local",
  bottomToolWindow: "vcsConsole",
  bottomExpanded: false,
  editorTabs: [],
  activeEditorTabId: null,
  vcsConsoleOutput: "",
  selectedRemote: "origin",
  projectClipboard: null,
  projectImportTarget: null,
  setRepo: (repo) =>
    set({
      repo,
      selectedRemote: repo?.remotes[0]?.name ?? "origin",
      editorTabs: repo
        ? [{ id: "welcome-editor", kind: "welcome", title: "Welcome" }]
        : [],
      activeEditorTabId: repo ? "welcome-editor" : null,
    }),
  setLeftToolWindow: (leftToolWindow) =>
    set({ leftToolWindow, leftPanelVisible: true }),
  toggleLeftToolWindow: (tool) =>
    set((s) =>
      s.leftToolWindow === tool && s.leftPanelVisible
        ? { leftPanelVisible: false }
        : { leftToolWindow: tool, leftPanelVisible: true },
    ),
  setLeftPanelVisible: (leftPanelVisible) => set({ leftPanelVisible }),
  setCommitTwTab: (commitTwTab) => {
    set({ commitTwTab, leftToolWindow: "git", leftPanelVisible: true });
  },
  setBottomToolWindow: (bottomToolWindow) =>
    set({ bottomToolWindow, bottomExpanded: true }),
  toggleBottomToolWindow: (tab) =>
    set((s) => ({
      bottomExpanded: s.bottomExpanded && s.bottomToolWindow === tab ? false : true,
      bottomToolWindow: tab,
    })),
  openEditorTab: (tab) => {
    const existing = get().editorTabs.find((t) => t.id === tab.id);
    if (existing) {
      set({ activeEditorTabId: tab.id });
      return;
    }
    set((s) => ({
      editorTabs: [...s.editorTabs, tab],
      activeEditorTabId: tab.id,
    }));
  },
  closeEditorTab: (id) =>
    set((s) => {
      const target = s.editorTabs.find((t) => t.id === id);
      if (!target || !isEditorTabClosable(target)) return s;
      const editorTabs = s.editorTabs.filter((t) => t.id !== id);
      const activeEditorTabId = pickActiveAfterClose(editorTabs, s.activeEditorTabId);
      return { editorTabs, activeEditorTabId };
    }),
  closeOtherEditorTabs: (id) =>
    set((s) => {
      const editorTabs = s.editorTabs.filter(
        (t) => t.id === id || !isEditorTabClosable(t),
      );
      const activeEditorTabId = pickActiveAfterClose(editorTabs, id);
      return { editorTabs, activeEditorTabId: activeEditorTabId ?? id };
    }),
  closeAllEditorTabs: () =>
    set((s) => {
      const editorTabs = s.editorTabs.filter((t) => !isEditorTabClosable(t));
      const activeEditorTabId = editorTabs[editorTabs.length - 1]?.id ?? null;
      return { editorTabs, activeEditorTabId };
    }),
  closeUnmodifiedEditorTabs: () =>
    set((s) => {
      const editorTabs = s.editorTabs.filter(
        (t) => !isEditorTabClosable(t) || t.pinned || t.id === s.activeEditorTabId,
      );
      const activeEditorTabId = pickActiveAfterClose(editorTabs, s.activeEditorTabId);
      return { editorTabs, activeEditorTabId };
    }),
  closeEditorTabsToLeft: (id) =>
    set((s) => {
      const index = s.editorTabs.findIndex((t) => t.id === id);
      if (index <= 0) return s;
      const editorTabs = s.editorTabs.filter(
        (t, i) => i >= index || !isEditorTabClosable(t),
      );
      const activeEditorTabId = pickActiveAfterClose(editorTabs, id);
      return { editorTabs, activeEditorTabId: activeEditorTabId ?? id };
    }),
  closeEditorTabsToRight: (id) =>
    set((s) => {
      const index = s.editorTabs.findIndex((t) => t.id === id);
      if (index < 0) return s;
      const editorTabs = s.editorTabs.filter(
        (t, i) => i <= index || !isEditorTabClosable(t),
      );
      const activeEditorTabId = pickActiveAfterClose(editorTabs, id);
      return { editorTabs, activeEditorTabId: activeEditorTabId ?? id };
    }),
  pinEditorTab: (id, pinned) =>
    set((s) => {
      const editorTabs = sortEditorTabsPinnedFirst(
        s.editorTabs.map((t) => (t.id === id ? { ...t, pinned } : t)),
      );
      return { editorTabs };
    }),
  setActiveEditorTab: (activeEditorTabId) => set({ activeEditorTabId }),
  openDiffEditor: (diff) => {
    let id: string;
    if (diff.mode === "branch" && diff.baseBranch && diff.headBranch) {
      id = `branch:${diff.baseBranch}:${diff.headBranch}:${diff.path}`;
    } else if (diff.mode === "branch_working" && diff.headBranch) {
      id = `branch-wt:${diff.headBranch}:${diff.path}`;
    } else {
      id = `diff:${diff.mode}:${diff.path}`;
    }
    get().openEditorTab({
      id,
      kind: "diff",
      title: diff.path.split("/").pop() ?? diff.path,
      diff: { ...diff, id },
    });
  },
  openFileEditor: (path) => {
    const id = `file:${path}`;
    get().openEditorTab({
      id,
      kind: "file",
      title: path.split("/").pop() ?? path,
      filePath: path,
    });
  },
  openLogEditor: () => {
    get().openEditorTab({ id: "git-log", kind: "log", title: "Git Log" });
  },
  openSettingsEditor: () => {
    get().openEditorTab({ id: "settings", kind: "settings", title: "Settings" });
  },
  openBranchesEditor: () => {
    get().openEditorTab({ id: "branches", kind: "branches", title: "Branches" });
  },
  appendVcsOutput: (text) =>
    set((s) => ({
      vcsConsoleOutput: s.vcsConsoleOutput + text + "\n",
      bottomExpanded: true,
      bottomToolWindow: s.bottomToolWindow ?? "vcsConsole",
    })),
  clearVcsOutput: () => set({ vcsConsoleOutput: "" }),
  setSelectedRemote: (selectedRemote) => set({ selectedRemote }),
  setProjectClipboard: (projectClipboard) => set({ projectClipboard }),
  setProjectImportTarget: (projectImportTarget) => set({ projectImportTarget }),
  resetWorkspace: () =>
    set({
      repo: null,
      editorTabs: [],
      activeEditorTabId: null,
      vcsConsoleOutput: "",
      bottomToolWindow: "vcsConsole",
      bottomExpanded: false,
      projectClipboard: null,
      projectImportTarget: null,
    }),
}));
