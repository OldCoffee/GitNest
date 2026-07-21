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
import { documentStore } from "../editor/documentStore";
import { isJdtUri, jdtDisplayName } from "../editor/lspClient";
import { navigationHistory } from "../editor/navigationHistory";

const SESSION_KEY_PREFIX = "gitnest.workspace:";

interface WorkspaceSession {
  editorTabs: EditorTab[];
  activeEditorTabId: string | null;
  leftToolWindow: LeftToolWindow;
  leftPanelVisible: boolean;
  bottomToolWindow: BottomToolWindow;
  bottomExpanded: boolean;
}

function sessionKey(path: string): string {
  return `${SESSION_KEY_PREFIX}${path}`;
}

function readSession(path: string): WorkspaceSession | null {
  try {
    const raw = localStorage.getItem(sessionKey(path));
    return raw ? (JSON.parse(raw) as WorkspaceSession) : null;
  } catch {
    return null;
  }
}

function isDirtyFileTab(tab: EditorTab): boolean {
  return tab.kind === "file" && !!tab.filePath && documentStore.isDirty(tab.filePath);
}

export type IdeNotificationLevel = "info" | "warning" | "error";

export interface IdeNotification {
  id: string;
  level: IdeNotificationLevel;
  source: string;
  title: string;
  message: string;
  time: number;
  read: boolean;
}

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
  recentFiles: string[];
  javaLspStatus: "idle" | "starting" | "installing" | "indexing" | "ready" | "error";
  javaLspDetail: string | null;
  javaLspPercent: number | null;
  javaLspLog: string[];
  ideNotifications: IdeNotification[];
  ideNotificationsOpen: boolean;
  pendingSessionTabs: EditorTab[];
  pendingLeftToolWindow: LeftToolWindow | null;
  setRepo: (repo: RepoInfo | null) => void;
  /** Restore a batch of pending session tabs. Returns true if more remain. */
  hydrateSessionTabs: (batchSize?: number) => boolean;
  setLeftToolWindow: (w: LeftToolWindow) => void;
  toggleLeftToolWindow: (w: LeftToolWindow) => void;
  setLeftPanelVisible: (visible: boolean) => void;
  setCommitTwTab: (tab: CommitTwTab) => void;
  setBottomToolWindow: (w: Exclude<BottomToolWindow, null>) => void;
  toggleBottomToolWindow: (w: Exclude<BottomToolWindow, null>) => void;
  openEditorTab: (tab: EditorTab) => void;
  closeEditorTab: (id: string) => void;
  forceCloseEditorTab: (id: string) => void;
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
  setJavaLspStatus: (
    status: "idle" | "starting" | "installing" | "indexing" | "ready" | "error",
    detail?: string | null,
    percent?: number | null,
  ) => void;
  appendJavaLspLog: (line: string) => void;
  pushIdeNotification: (input: {
    level?: IdeNotificationLevel;
    source?: string;
    title: string;
    message: string;
  }) => void;
  setIdeNotificationsOpen: (open: boolean) => void;
  markIdeNotificationsRead: () => void;
  clearIdeNotifications: () => void;
  resetWorkspace: () => void;
}

export const useAppStore = create<AppStore>((set, get) => ({
  repo: null,
  leftToolWindow: "project",
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
  recentFiles: [],
  javaLspStatus: "idle",
  javaLspDetail: null,
  javaLspPercent: null,
  javaLspLog: [],
  ideNotifications: [],
  ideNotificationsOpen: false,
  pendingSessionTabs: [],
  pendingLeftToolWindow: null,
  setRepo: (repo) => {
    const prev = get().repo;
    // Soft refresh of the same project — keep tabs / LSP status (invalidate must not
    // wipe indexing UI or re-trigger a cold session restore).
    if (repo && prev?.path === repo.path) {
      set({
        repo,
        selectedRemote: repo.remotes[0]?.name ?? get().selectedRemote,
      });
      return;
    }

    const session = repo ? readSession(repo.path) : null;
    const welcomeTab: EditorTab = { id: "welcome-editor", kind: "welcome", title: "Welcome" };
    // Fresh project — drop go-to-definition history from the previous workspace.
    navigationHistory.clear();
    set({
      repo,
      selectedRemote: repo?.remotes[0]?.name ?? "origin",
      // Cold open: welcome only — never restore previously opened editor tabs.
      editorTabs: repo ? [welcomeTab] : [],
      activeEditorTabId: repo ? welcomeTab.id : null,
      pendingSessionTabs: [],
      pendingLeftToolWindow: null,
      // Always open on Project explorer; user can switch to Git from the activity bar.
      leftToolWindow: "project",
      leftPanelVisible: session?.leftPanelVisible ?? true,
      // Always keep bottom panel collapsed on project open — terminal/VCS is opt-in.
      bottomToolWindow: session?.bottomToolWindow ?? "vcsConsole",
      bottomExpanded: false,
      recentFiles: [],
      javaLspStatus: "idle",
      javaLspDetail: null,
      javaLspPercent: null,
      javaLspLog: [],
      ideNotifications: [],
      ideNotificationsOpen: false,
    });
  },
  hydrateSessionTabs: (batchSize = 8) => {
    const pending = get().pendingSessionTabs;
    if (pending.length === 0) {
      if (get().pendingLeftToolWindow != null) {
        set({ pendingLeftToolWindow: null });
      }
      return false;
    }
    const take = Math.max(1, batchSize);
    const batch = pending.slice(0, take);
    const rest = pending.slice(take);
    set((s) => {
      const welcome =
        s.editorTabs.find((tab) => tab.kind === "welcome") ??
        ({ id: "welcome-editor", kind: "welcome", title: "Welcome" } as EditorTab);
      const existingIds = new Set(s.editorTabs.map((tab) => tab.id));
      const additions = batch.filter(
        (tab) =>
          tab.id !== welcome.id &&
          tab.kind !== "welcome" &&
          !existingIds.has(tab.id),
      );
      return {
        editorTabs: [...s.editorTabs, ...additions],
        pendingSessionTabs: rest,
        // Keep the light Git panel — switching to Project mid-open causes a hitch.
        pendingLeftToolWindow: null,
        activeEditorTabId: welcome.id,
      };
    });
    return rest.length > 0;
  },
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
      if (isDirtyFileTab(target)) return s;
      const editorTabs = s.editorTabs.filter((t) => t.id !== id);
      const activeEditorTabId = pickActiveAfterClose(editorTabs, s.activeEditorTabId);
      if (target.filePath) documentStore.close(target.filePath, true);
      return { editorTabs, activeEditorTabId };
    }),
  forceCloseEditorTab: (id) =>
    set((s) => {
      const target = s.editorTabs.find((t) => t.id === id);
      if (!target || !isEditorTabClosable(target)) return s;
      const editorTabs = s.editorTabs.filter((t) => t.id !== id);
      const activeEditorTabId = pickActiveAfterClose(editorTabs, s.activeEditorTabId);
      if (target.filePath) documentStore.close(target.filePath, true);
      return { editorTabs, activeEditorTabId };
    }),
  closeOtherEditorTabs: (id) =>
    set((s) => {
      const editorTabs = s.editorTabs.filter(
        (t) => t.id === id || !isEditorTabClosable(t) || isDirtyFileTab(t),
      );
      const activeEditorTabId = pickActiveAfterClose(editorTabs, id);
      return { editorTabs, activeEditorTabId: activeEditorTabId ?? id };
    }),
  closeAllEditorTabs: () =>
    set((s) => {
      const editorTabs = s.editorTabs.filter(
        (t) => !isEditorTabClosable(t) || isDirtyFileTab(t),
      );
      const activeEditorTabId = editorTabs[editorTabs.length - 1]?.id ?? null;
      return { editorTabs, activeEditorTabId };
    }),
  closeUnmodifiedEditorTabs: () =>
    set((s) => {
      const editorTabs = s.editorTabs.filter(
        (t) =>
          !isEditorTabClosable(t) ||
          t.pinned ||
          isDirtyFileTab(t) ||
          t.id === s.activeEditorTabId,
      );
      const activeEditorTabId = pickActiveAfterClose(editorTabs, s.activeEditorTabId);
      return { editorTabs, activeEditorTabId };
    }),
  closeEditorTabsToLeft: (id) =>
    set((s) => {
      const index = s.editorTabs.findIndex((t) => t.id === id);
      if (index <= 0) return s;
      const editorTabs = s.editorTabs.filter(
        (t, i) => i >= index || !isEditorTabClosable(t) || isDirtyFileTab(t),
      );
      const activeEditorTabId = pickActiveAfterClose(editorTabs, id);
      return { editorTabs, activeEditorTabId: activeEditorTabId ?? id };
    }),
  closeEditorTabsToRight: (id) =>
    set((s) => {
      const index = s.editorTabs.findIndex((t) => t.id === id);
      if (index < 0) return s;
      const editorTabs = s.editorTabs.filter(
        (t, i) => i <= index || !isEditorTabClosable(t) || isDirtyFileTab(t),
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
    const title = isJdtUri(path) ? jdtDisplayName(path) : path.split(/[/\\]/).pop() ?? path;
    // Prefetch so the editor doesn't stall on first paint waiting for disk IPC.
    if (!isJdtUri(path) && !documentStore.has(path)) {
      void documentStore.load(path);
    }
    get().openEditorTab({
      id,
      kind: "file",
      title,
      filePath: path,
    });
    if (!isJdtUri(path)) {
      set((s) => ({
        recentFiles: [path, ...s.recentFiles.filter((item) => item !== path)].slice(0, 30),
      }));
    }
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
  setJavaLspStatus: (javaLspStatus, detail, percent) =>
    set((s) => ({
      javaLspStatus,
      javaLspDetail: detail === undefined ? s.javaLspDetail : detail,
      javaLspPercent:
        percent !== undefined
          ? percent
          : javaLspStatus === "idle" ||
              javaLspStatus === "ready" ||
              javaLspStatus === "error"
            ? null
            : s.javaLspPercent,
    })),
  appendJavaLspLog: (line) =>
    set((s) => {
      const trimmed = line.trim();
      if (!trimmed) return s;
      if (s.javaLspLog[s.javaLspLog.length - 1] === trimmed) return s;
      return { javaLspLog: [...s.javaLspLog.slice(-199), trimmed] };
    }),
  pushIdeNotification: ({ level = "info", source = "GitNest", title, message }) =>
    set((s) => {
      const newest = s.ideNotifications[0];
      if (
        newest &&
        newest.message === message &&
        newest.title === title &&
        Date.now() - newest.time < 2500
      ) {
        return s;
      }
      return {
        ideNotifications: [
          {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            level,
            source,
            title,
            message,
            time: Date.now(),
            read: false,
          },
          ...s.ideNotifications,
        ].slice(0, 100),
      };
    }),
  setIdeNotificationsOpen: (ideNotificationsOpen) => set({ ideNotificationsOpen }),
  markIdeNotificationsRead: () =>
    set((s) => ({
      ideNotifications: s.ideNotifications.map((item) =>
        item.read ? item : { ...item, read: true },
      ),
    })),
  clearIdeNotifications: () => set({ ideNotifications: [], javaLspLog: [] }),
  resetWorkspace: () =>
    set({
      repo: null,
      editorTabs: [],
      activeEditorTabId: null,
      pendingSessionTabs: [],
      pendingLeftToolWindow: null,
      vcsConsoleOutput: "",
      bottomToolWindow: "vcsConsole",
      bottomExpanded: false,
      projectClipboard: null,
      projectImportTarget: null,
      recentFiles: [],
      javaLspStatus: "idle",
      javaLspDetail: null,
      javaLspPercent: null,
      javaLspLog: [],
      ideNotifications: [],
      ideNotificationsOpen: false,
    }),
}));

let persistTimer: number | null = null;
useAppStore.subscribe((state) => {
  if (!state.repo) return;
  if (persistTimer != null) window.clearTimeout(persistTimer);
  persistTimer = window.setTimeout(() => {
    const persist = () => {
      const welcome: EditorTab = {
        id: "welcome-editor",
        kind: "welcome",
        title: "Welcome",
      };
      const session: WorkspaceSession = {
        // Do not persist open files — next launch always starts on Welcome.
        editorTabs: [welcome],
        activeEditorTabId: welcome.id,
        leftToolWindow: state.pendingLeftToolWindow ?? state.leftToolWindow,
        leftPanelVisible: state.leftPanelVisible,
        bottomToolWindow: state.bottomToolWindow,
        bottomExpanded: state.bottomExpanded,
      };
      localStorage.setItem(sessionKey(state.repo!.path), JSON.stringify(session));
    };
    const ric = (
      window as Window & {
        requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      }
    ).requestIdleCallback;
    if (typeof ric === "function") {
      ric(persist, { timeout: 1500 });
    } else {
      persist();
    }
  }, 1000);
});
