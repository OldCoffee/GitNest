import { listen } from "@tauri-apps/api/event";
import { api } from "../lib/api";

interface LspEnvelope {
  sessionId: number;
  message: {
    id?: number | string;
    method?: string;
    params?: unknown;
    result?: unknown;
    error?: unknown;
  };
}

type NotificationListener = (params: unknown) => void;

export type JavaLspProgress = {
  phase: "starting" | "installing" | "indexing" | "ready" | "error" | "idle";
  message: string | null;
  percent: number | null;
};

type ProgressListener = (progress: JavaLspProgress) => void;

export function formatLspError(error: unknown): string {
  if (error == null) return "Unknown language server error";
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message || String(error);
  if (typeof error === "object") {
    const record = error as { message?: unknown; code?: unknown; data?: unknown };
    if (typeof record.message === "string" && record.message.trim()) {
      const code =
        typeof record.code === "number" || typeof record.code === "string"
          ? ` (${record.code})`
          : "";
      return `${record.message}${code}`;
    }
    try {
      return JSON.stringify(error);
    } catch {
      return "Unknown language server error";
    }
  }
  return String(error);
}

/** Missing JDK / bad paths / JDT LS config — retrying will not help until settings change. */
export function isConfigurationLspError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("no jdk") ||
    lower.includes("install a jdk") ||
    lower.includes("jdk not found") ||
    lower.includes("jdk for jdt") ||
    lower.includes("configured jdk") ||
    lower.includes("configured maven") ||
    lower.includes("configured jdt") ||
    lower.includes("jdt language server requires") ||
    lower.includes("language server is not configured") ||
    lower.includes("not configured") ||
    lower.includes("invalid (need plugins") ||
    lower.includes("need plugins/") ||
    lower.includes("need bin/") ||
    lower.includes("settings → java") ||
    lower.includes("settings -> java")
  );
}

export const LSP_CONFIG_FAILURE_COOLDOWN_MS = 120_000;
export const LSP_TRANSIENT_FAILURE_COOLDOWN_MS = 15_000;

export type LspStartFailure = {
  rootPath: string;
  message: string;
  at: number;
  configuration: boolean;
};

/** Whether ensureStarted should reject immediately without re-probing JDK / spawning JDT LS. */
export function shouldReuseStartFailure(
  failure: LspStartFailure | null,
  rootPath: string,
  now = Date.now(),
  configCooldownMs = LSP_CONFIG_FAILURE_COOLDOWN_MS,
  transientCooldownMs = LSP_TRANSIENT_FAILURE_COOLDOWN_MS,
): boolean {
  if (!failure || failure.rootPath !== rootPath) return false;
  const cooldown = failure.configuration ? configCooldownMs : transientCooldownMs;
  return now - failure.at < cooldown;
}

export function isJdtUri(uri: string): boolean {
  return uri.startsWith("jdt:") || uri.startsWith("jdt://");
}

/** Prefer path `.../String.class?...` over query suffix `.../<java.lang(String.class`. */
export function jdtDisplayName(uri: string): string {
  let decoded = uri;
  try {
    decoded = decodeURIComponent(uri);
  } catch {
    // keep raw
  }
  const pathPart = (decoded.split("?")[0] ?? decoded).split("#")[0] ?? decoded;
  const pathMatch = pathPart.match(/\/([^/]+)\.class$/i);
  if (pathMatch?.[1]) return `${pathMatch[1]}.class`;

  const queryMatch = decoded.match(/<([^(]+)\(([^)]+)\.class/);
  if (queryMatch?.[2]) {
    return queryMatch[2].toLowerCase().endsWith(".class")
      ? queryMatch[2]
      : `${queryMatch[2]}.class`;
  }
  return "Class";
}

const JAVA_SETTINGS_BASE = {
  references: { includeDecompiledSources: true },
  import: {
    maven: { enabled: true },
    gradle: { enabled: true },
    exclusions: [
      "**/node_modules/**",
      "**/.metadata/**",
      "**/archetype-resources/**",
      "**/META-INF/maven/**",
      "**/.git/gitnest/**",
    ],
  },
  maven: { downloadSources: false },
  eclipse: { downloadSources: false },
  sources: {},
  project: {
    resourceFilters: ["node_modules", "\\.git", "\\.svn", "target", "build", "out"],
  },
} as const;

function buildJavaSettings(
  maven: {
    globalSettings: string | null;
    userSettings: string | null;
  },
  projectJavaHome?: string | null,
) {
  const configuration: Record<string, unknown> = {
    updateBuildConfiguration: "automatic",
  };
  const mavenConfig: Record<string, string> = {};
  if (maven.globalSettings) mavenConfig.globalSettings = maven.globalSettings;
  if (maven.userSettings) mavenConfig.userSettings = maven.userSettings;
  if (Object.keys(mavenConfig).length > 0) {
    configuration.maven = mavenConfig;
  }
  if (projectJavaHome) {
    configuration.runtimes = [
      {
        name: "JavaSE-17",
        path: projectJavaHome,
        default: true,
      },
    ];
  }
  return {
    ...JAVA_SETTINGS_BASE,
    configuration,
    home: projectJavaHome || undefined,
  };
}

function javaConfigValue(section: string | undefined, javaSettings: Record<string, unknown>): unknown {
  if (!section || section === "java") return javaSettings;
  if (!section.startsWith("java.")) return null;
  const parts = section.slice("java.".length).split(".");
  let current: unknown = javaSettings;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return null;
    current = (current as Record<string, unknown>)[part];
  }
  return current ?? null;
}

const INDEX_RELEVANT =
  /\.(java|class|jar)$|\/pom\.xml$|\/build\.gradle(\.kts)?$|\/settings\.gradle(\.kts)?$/i;

function isIndexRelevantPath(relativePath: string): boolean {
  const normalized = relativePath.replace(/\\/g, "/");
  if (normalized.startsWith(".git/") || normalized.includes("/.git/")) return false;
  if (normalized.includes(".git/gitnest/") || normalized.includes("/gitnest/jdtls-workspace")) {
    return false;
  }
  const parts = normalized.toLowerCase().split("/");
  if (parts.some((part) => part === "target" || part === "build" || part === "out" || part === "bin")) {
    return false;
  }
  const base = normalized.split("/").pop() ?? normalized;
  if (base.endsWith(".class")) return false;
  return (
    INDEX_RELEVANT.test(normalized) ||
    base === "pom.xml" ||
    base.startsWith("build.gradle") ||
    base.startsWith("settings.gradle")
  );
}

function fileChangeType(kind: "create" | "modify" | "remove"): 1 | 2 | 3 {
  if (kind === "create") return 1;
  if (kind === "remove") return 3;
  return 2;
}

function cleanProgressLabel(title?: string, message?: string): string | null {
  const tit = title?.trim() ?? "";
  const msg = message?.trim() ?? "";
  if (!tit && !msg) return null;
  if (!tit) return msg;
  if (!msg) return tit;
  if (msg === tit) return msg;
  if (msg.startsWith(tit) || msg.includes(` - ${tit}`) || msg.includes(` · ${tit}`)) return msg;
  if (tit.startsWith(msg)) return tit;
  if (msg.toLowerCase().startsWith(tit.toLowerCase())) return msg;
  return `${tit} · ${msg}`;
}

function extractPercent(...parts: Array<string | null | undefined>): number | null {
  for (const part of parts) {
    if (!part) continue;
    const match = part.match(/(\d{1,3})\s*%/);
    if (match) {
      const value = Number(match[1]);
      if (Number.isFinite(value)) return Math.max(0, Math.min(100, value));
    }
  }
  return null;
}

function stripEmbeddedPercent(text: string): string {
  return text
    .replace(/\s*\d{1,3}\s*%/g, "")
    .replace(/\s*[-–·|]+\s*$/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Late Eclipse jobs that often stall the UI near 95% without blocking navigation. */
function isNoisyIndexLabel(label: string | null | undefined): boolean {
  if (!label) return false;
  const lower = label.toLowerCase();
  return (
    lower.includes("publish diagnostics") ||
    lower.includes("validate documents") ||
    lower.includes("report problems") ||
    (lower.includes("building workspace") && lower.includes("diagnos"))
  );
}

/** Eclipse "Building" / "Searching" plateaus (often ~80%) after modules are already indexed. */
function isBuildPlateauLabel(label: string | null | undefined): boolean {
  if (!label) return false;
  const lower = label.toLowerCase();
  if (isNoisyIndexLabel(label)) return true;
  return (
    lower === "building" ||
    lower.startsWith("building ") ||
    lower.startsWith("building ·") ||
    lower.startsWith("searching") ||
    lower.includes("building index") ||
    lower === "buildingindex"
  );
}

class JavaLspClient {
  private sessionId: number | null = null;
  private rootPath: string | null = null;
  private nextId = 1;
  private pending = new Map<
    number,
    { resolve: (value: unknown) => void; reject: (reason: unknown) => void }
  >();
  private notifications = new Map<string, Set<NotificationListener>>();
  private progressListeners = new Set<ProgressListener>();
  private startPromise: Promise<void> | null = null;
  private unlisten: (() => void) | null = null;
  private ready = false;
  private serviceReady = false;
  private projectReady = false;
  private reusedIndex = false;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private stallTimer: ReturnType<typeof setTimeout> | null = null;
  private progress: JavaLspProgress = { phase: "idle", message: null, percent: null };
  private startFailure: LspStartFailure | null = null;
  private statusCache:
    | {
        at: number;
        value: Awaited<ReturnType<typeof api.javaLspStatus>>;
      }
    | null = null;
  private javaSettings: Record<string, unknown> = buildJavaSettings({
    globalSettings: null,
    userSettings: null,
  });

  private async probeStatus(force = false) {
    const now = Date.now();
    if (!force && this.statusCache && now - this.statusCache.at < 30_000) {
      return this.statusCache.value;
    }
    const value = await api.javaLspStatus();
    this.statusCache = { at: now, value };
    return value;
  }

  private yieldToUi(): Promise<void> {
    return new Promise((resolve) => {
      requestAnimationFrame(() => {
        window.setTimeout(resolve, 0);
      });
    });
  }

  isReady(): boolean {
    return this.ready && this.sessionId != null;
  }

  isStarting(): boolean {
    return this.startPromise != null && !this.ready;
  }

  isProjectReady(): boolean {
    return this.projectReady;
  }

  getProgress(): JavaLspProgress {
    return this.progress;
  }

  getStartFailure(): LspStartFailure | null {
    return this.startFailure;
  }

  /** Clear latched start failure (e.g. after Java settings change) so the next start can probe again. */
  clearStartFailure(): void {
    this.startFailure = null;
    this.statusCache = null;
  }

  subscribeProgress(listener: ProgressListener): () => void {
    this.progressListeners.add(listener);
    listener(this.progress);
    return () => {
      this.progressListeners.delete(listener);
    };
  }

  private setProgress(
    phase: JavaLspProgress["phase"],
    message: string | null = null,
    percent: number | null = null,
    options?: { allowRegression?: boolean },
  ) {
    const nextPercent =
      percent == null
        ? null
        : Math.max(0, Math.min(100, Math.round(percent)));
    const cleanedMessage =
      message == null ? null : stripEmbeddedPercent(message) || message;
    // Avoid regressing percent during the same indexing run, unless a new job begins.
    const mergedPercent =
      !options?.allowRegression &&
      phase === "indexing" &&
      nextPercent != null &&
      this.progress.phase === "indexing" &&
      this.progress.percent != null
        ? Math.max(this.progress.percent, nextPercent)
        : nextPercent;
    const next = { phase, message: cleanedMessage, percent: mergedPercent };
    if (
      this.progress.phase === next.phase &&
      this.progress.message === next.message &&
      this.progress.percent === next.percent
    ) {
      return;
    }
    this.progress = next;
    this.armStallWatchdog();
    for (const listener of this.progressListeners) {
      listener(this.progress);
    }
  }

  private clearStallWatchdog() {
    if (this.stallTimer != null) {
      clearTimeout(this.stallTimer);
      this.stallTimer = null;
    }
  }

  /** If Building/Searching sits at a high % with no updates, treat the project as usable. */
  private armStallWatchdog() {
    this.clearStallWatchdog();
    if (this.progress.phase !== "indexing" || this.projectReady) return;
    if (!this.ready && !this.serviceReady) return;
    const percent = this.progress.percent ?? 0;
    if (percent < 70) return;
    const label = this.progress.message;
    const plateau = isBuildPlateauLabel(label) || percent >= 80;
    if (!plateau) return;
    this.stallTimer = setTimeout(() => {
      this.stallTimer = null;
      if (this.projectReady || this.sessionId == null) return;
      if (this.progress.phase !== "indexing") return;
      // No meaningful progress for a while at a high plateau — stop blocking the UI.
      this.serviceReady = true;
      this.projectReady = true;
      this.setProgress("ready", null, 100, { allowRegression: true });
    }, 8_000);
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.ready && this.projectReady) {
        this.stopHeartbeat();
        return;
      }
      if (this.progress.phase !== "indexing" && this.progress.phase !== "starting") return;
      // Only soft-creep when the server has not reported a concrete percentage yet.
      if (this.progress.percent != null && this.progress.percent > 0) return;
      const current = this.progress.percent ?? 5;
      if (current < 30) {
        this.setProgress(this.progress.phase, this.progress.message, current + 1);
      }
    }, 2000);
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer != null) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  async ensureStarted(rootPath: string): Promise<void> {
    if (this.sessionId != null && this.ready && this.rootPath === rootPath) return;

    // Latch config / recent failures so opening more .java tabs does not re-spawn probes.
    if (shouldReuseStartFailure(this.startFailure, rootPath)) {
      const message = this.startFailure!.message;
      if (this.progress.phase !== "error") {
        this.setProgress("error", message, null);
      }
      throw new Error(message);
    }
    if (this.startFailure?.rootPath === rootPath) {
      // Cooldown elapsed — allow one more attempt.
      this.startFailure = null;
      this.statusCache = null;
    }

    if (this.startPromise) {
      // Same root already starting — join that promise.
      if (this.rootPath === rootPath || this.rootPath == null) return this.startPromise;
    }
    this.startPromise = this.start(rootPath)
      .then(() => {
        // Keep the resolved promise so concurrent callers finish; clear only on stop/error.
      })
      .catch((error) => {
        this.startPromise = null;
        throw error instanceof Error ? error : new Error(formatLspError(error));
      });
    return this.startPromise;
  }

  /** Start indexing in the background when a Java/Maven/Gradle project is opened. */
  async warmStart(rootPath: string): Promise<void> {
    try {
      await this.ensureStarted(rootPath);
    } catch {
      // Progress/error UI is handled by subscribeProgress.
    }
  }

  private noteLanguageStatus(params: unknown) {
    const status = params as { type?: string; message?: string } | undefined;
    if (!status?.type) return;
    const type = status.type;
    const message = typeof status.message === "string" ? status.message.trim() : "";

    if (type === "ServiceReady" || type === "Started") {
      this.serviceReady = true;
      if (!this.projectReady) {
        this.setProgress(
          "indexing",
          this.reusedIndex ? "loadingCachedIndex" : "buildingIndex",
          Math.max(this.progress.percent ?? 0, this.reusedIndex ? 40 : 30),
        );
      }
    }
    if (type === "ProjectStatus" && (message === "OK" || message === "WARNING" || message === "ERROR")) {
      this.serviceReady = true;
      if (message === "OK" || message === "WARNING") {
        this.projectReady = true;
        this.setProgress(this.ready ? "ready" : "indexing", null, 100);
      }
    }
    if (type === "Starting" && message) {
      const match = message.match(/(\d+)\s*%/);
      const percent = match ? Number(match[1]) : this.progress.percent;
      this.setProgress("indexing", message, percent);
      return;
    }
    if (
      !this.projectReady &&
      message &&
      message !== "OK" &&
      message !== "WARNING" &&
      message !== "ERROR" &&
      type !== "ServiceReady" &&
      type !== "Started"
    ) {
      const match = message.match(/(\d+)\s*%/);
      this.setProgress("indexing", message, match ? Number(match[1]) : this.progress.percent);
    }
  }

  private markImportUsableFromNoisyProgress(percent: number | null) {
    const highEnough =
      (percent != null && percent >= 75) ||
      (this.progress.percent != null && this.progress.percent >= 75);
    if (!highEnough) return false;
    // Building / Publish Diagnostics often linger after the project is navigable.
    this.serviceReady = true;
    this.projectReady = true;
    this.clearStallWatchdog();
    if (this.ready) {
      this.setProgress("ready", null, 100, { allowRegression: true });
      return true;
    }
    this.setProgress("indexing", "buildingIndex", Math.max(this.progress.percent ?? 0, percent ?? 75), {
      allowRegression: true,
    });
    return true;
  }

  private noteWorkDoneProgress(params: unknown) {
    const payload = params as {
      token?: string | number;
      value?: {
        kind?: string;
        title?: string;
        message?: string;
        percentage?: number;
      };
    };
    const value = payload?.value;
    if (!value?.kind) return;

    const label =
      cleanProgressLabel(value.title, value.message) ??
      (value.kind === "end" ? this.progress.message : null) ??
      "buildingIndex";
    let percent =
      typeof value.percentage === "number" && Number.isFinite(value.percentage)
        ? value.percentage
        : extractPercent(value.message, value.title);

    // Once usable, ignore late Eclipse jobs so the bar doesn't bounce back to Building 80%.
    if (this.ready && this.projectReady) {
      const lower = (label ?? "").toLowerCase();
      if (lower.includes("updating") || lower === "updatingindex") {
        this.setProgress("indexing", "updatingIndex", percent ?? 50, { allowRegression: true });
      }
      return;
    }

    if (value.kind === "begin") {
      if (isBuildPlateauLabel(label) && this.markImportUsableFromNoisyProgress(percent)) {
        return;
      }
      this.setProgress("indexing", label, percent ?? 0, { allowRegression: true });
      return;
    }

    if (value.kind === "end") {
      if (isBuildPlateauLabel(label) && this.markImportUsableFromNoisyProgress(percent ?? 90)) {
        return;
      }
      // Job finished — bump toward completion; if already high, mark usable.
      const next = Math.min(99, Math.max(this.progress.percent ?? 0, percent ?? 0, 80));
      if (next >= 80 && this.ready) {
        this.markImportUsableFromNoisyProgress(next);
        return;
      }
      this.setProgress("indexing", label, next, { allowRegression: true });
      return;
    }

    if (percent == null) percent = this.progress.percent ?? 15;
    // Searching/Building at ≥80% (or any plateau label at ≥75%) → usable.
    if (
      (percent >= 80 || (isBuildPlateauLabel(label) && percent >= 75)) &&
      this.markImportUsableFromNoisyProgress(percent)
    ) {
      return;
    }
    if (isBuildPlateauLabel(label)) {
      // Flat Building reports — keep stall watchdog armed without regressing %.
      if ((this.progress.percent ?? 0) >= 80 && percent <= (this.progress.percent ?? 0)) {
        this.armStallWatchdog();
        return;
      }
    }
    this.setProgress("indexing", label, percent, { allowRegression: true });
  }

  private noteLegacyProgressReport(params: unknown) {
    const report = params as {
      status?: string;
      task?: string;
      subTask?: string;
      totalWork?: number;
      workDone?: number;
      complete?: boolean;
    };
    if (!report) return;
    const raw =
      (typeof report.status === "string" && report.status.trim()) ||
      cleanProgressLabel(report.task, report.subTask) ||
      this.progress.message;
    if (this.ready && this.projectReady) {
      return;
    }
    const percent: number | null =
      typeof report.totalWork === "number" &&
      report.totalWork > 0 &&
      typeof report.workDone === "number"
        ? (report.workDone / report.totalWork) * 100
        : extractPercent(raw ?? undefined);
    if (isBuildPlateauLabel(raw) && this.markImportUsableFromNoisyProgress(percent ?? (report.complete ? 90 : null))) {
      return;
    }
    if (report.complete) {
      const next = Math.min(99, Math.max(percent ?? 0, this.progress.percent ?? 0, 80));
      if (next >= 80 && this.ready) {
        this.markImportUsableFromNoisyProgress(next);
        return;
      }
      this.setProgress("indexing", raw, next, {
        allowRegression: true,
      });
      return;
    }
    this.setProgress("indexing", raw, percent ?? this.progress.percent ?? 15, {
      allowRegression: true,
    });
  }

  private async start(rootPath: string): Promise<void> {
    if (this.sessionId != null) {
      await this.stop().catch(() => undefined);
    }

    this.setProgress("starting", null, 2);
    await this.yieldToUi();

    try {
      const status = await this.probeStatus(true);
      await this.yieldToUi();
      if (!status.available) {
        throw new Error(status.error ?? "Java language server is not configured");
      }
      if (status.needsInstall) {
        this.setProgress("installing", null, 5);
        await this.yieldToUi();
      }

      this.javaSettings = buildJavaSettings(
        {
          globalSettings: status.mavenGlobalSettings,
          userSettings: status.mavenUserSettings,
        },
        status.javaHome,
      );

      // Assign session id before listening so no early messages are dropped.
      this.sessionId = await api.javaLspStart();
      await this.yieldToUi();
      this.rootPath = rootPath;
      this.serviceReady = false;
      this.projectReady = false;
      this.reusedIndex = status.hasWorkspaceCache === true;

      this.unlisten = await listen<LspEnvelope>("lsp-message", ({ payload }) => {
        if (payload.sessionId !== this.sessionId) return;
        const message = payload.message;
        if (message.id != null && message.method) {
          void this.handleServerRequest(message.id, message.method, message.params);
          return;
        }
        if (message.id != null) {
          const pending = this.pending.get(Number(message.id));
          if (!pending) return;
          this.pending.delete(Number(message.id));
          if (message.error) {
            pending.reject(new Error(formatLspError(message.error)));
          } else {
            pending.resolve(message.result);
          }
        } else if (message.method) {
          if (message.method === "language/status") {
            this.noteLanguageStatus(message.params);
          } else if (message.method === "$/progress") {
            this.noteWorkDoneProgress(message.params);
          } else if (message.method === "language/progressReport") {
            this.noteLegacyProgressReport(message.params);
          }
          for (const listener of this.notifications.get(message.method) ?? []) {
            listener(message.params);
          }
        }
      });

      this.setProgress(
        "indexing",
        this.reusedIndex ? "loadingCachedIndex" : "buildingIndex",
        this.reusedIndex ? 8 : 5,
      );
      await this.yieldToUi();

      const rootUri = pathToUri(rootPath);
      await this.requestWithTimeout(
        "initialize",
        {
          processId: null,
          rootUri,
          rootPath,
          workspaceFolders: [
            { uri: rootUri, name: rootPath.split(/[/\\]/).pop() ?? "workspace" },
          ],
          capabilities: {
            window: {
              workDoneProgress: true,
              showMessage: { messageActionItem: { additionalPropertiesSupport: false } },
            },
            textDocument: {
              synchronization: { dynamicRegistration: true, didSave: true },
              completion: { completionItem: { snippetSupport: false } },
              hover: { contentFormat: ["markdown", "plaintext"] },
              definition: { linkSupport: true },
              typeDefinition: { linkSupport: true },
              references: {},
              rename: { prepareSupport: true },
              formatting: {},
              codeAction: {},
              publishDiagnostics: { relatedInformation: true },
            },
            workspace: {
              workspaceFolders: true,
              configuration: true,
              didChangeConfiguration: { dynamicRegistration: true },
              didChangeWatchedFiles: { dynamicRegistration: true },
            },
          },
          initializationOptions: {
            extendedClientCapabilities: {
              progressReportProvider: false,
              classFileContentsSupport: true,
              overrideMethodsPromptSupport: false,
              hashCodeEqualsPromptSupport: false,
              advancedGenerateAccessorsSupport: false,
              advancedExtractRefactoringSupport: false,
              generateToStringPromptSupport: false,
            },
            settings: {
              java: this.javaSettings,
            },
          },
        },
        120_000,
      );
      // Only animate progress after the server actually answered initialize.
      this.startHeartbeat();
      await this.notify("initialized", {});
      await this.notify("workspace/didChangeConfiguration", {
        settings: { java: this.javaSettings },
      });
      this.setProgress(
        "indexing",
        this.reusedIndex ? "loadingCachedIndex" : "buildingIndex",
        Math.max(this.progress.percent ?? 0, 18),
      );

      // Usable once the language server is up — Maven import continues in background.
      await this.waitForFlag(() => this.serviceReady, this.reusedIndex ? 20_000 : 45_000);
      this.ready = true;
      this.startFailure = null;
      this.setProgress(
        this.projectReady ? "ready" : "indexing",
        this.projectReady ? null : this.reusedIndex ? "loadingCachedIndex" : "buildingIndex",
        this.projectReady ? 100 : Math.max(this.progress.percent ?? 0, 35),
      );

      void this.finishProjectImport();
    } catch (error) {
      this.stopHeartbeat();
      const message = formatLspError(error);
      this.startFailure = {
        rootPath,
        message,
        at: Date.now(),
        configuration: isConfigurationLspError(message),
      };
      this.setProgress("error", message, null);
      const sessionId = this.sessionId;
      this.sessionId = null;
      this.rootPath = null;
      this.ready = false;
      this.serviceReady = false;
      this.projectReady = false;
      this.startPromise = null;
      this.pending.clear();
      if (sessionId != null) {
        await api.lspStop(sessionId).catch(() => undefined);
      }
      this.unlisten?.();
      this.unlisten = null;
      throw error instanceof Error ? error : new Error(message);
    }
  }

  private async finishProjectImport(): Promise<void> {
    try {
      // Don't wait forever — Building often plateaus around 80% on large Maven trees.
      await this.waitForFlag(() => this.projectReady, this.reusedIndex ? 20_000 : 35_000);
      if (!this.projectReady && this.sessionId != null) {
        const percent = this.progress.percent ?? 0;
        if (percent >= 70 || isBuildPlateauLabel(this.progress.message)) {
          this.serviceReady = true;
          this.projectReady = true;
        } else if (this.serviceReady) {
          this.projectReady = true;
        } else {
          this.setProgress("indexing", "buildingIndex", Math.max(percent, 70));
          try {
            await this.requestWithTimeout("java/buildWorkspace", false, 30_000);
            this.projectReady = true;
          } catch {
            this.projectReady = this.serviceReady || percent >= 60;
          }
        }
      }
    } finally {
      this.stopHeartbeat();
      this.clearStallWatchdog();
      if (this.sessionId != null) {
        this.projectReady = true;
        this.serviceReady = true;
        this.setProgress("ready", null, 100, { allowRegression: true });
      }
    }
  }

  private waitForFlag(isReady: () => boolean, timeoutMs: number): Promise<void> {
    if (isReady()) return Promise.resolve();
    return new Promise((resolve) => {
      const timer = window.setTimeout(() => {
        unsubStatus();
        unsubProgress();
        unsubLegacy();
        resolve();
      }, timeoutMs);
      const done = () => {
        if (!isReady()) return;
        window.clearTimeout(timer);
        unsubStatus();
        unsubProgress();
        unsubLegacy();
        resolve();
      };
      const unsubStatus = this.subscribe("language/status", (params) => {
        this.noteLanguageStatus(params);
        done();
      });
      const unsubProgress = this.subscribe("$/progress", (params) => {
        this.noteWorkDoneProgress(params);
        done();
      });
      const unsubLegacy = this.subscribe("language/progressReport", (params) => {
        this.noteLegacyProgressReport(params);
        done();
      });
    });
  }

  /** Incremental index update for create / modify / delete on disk. */
  async applyWorkspaceChanges(
    relativePaths: string[],
    kind: "create" | "modify" | "remove",
  ): Promise<void> {
    if (!this.ready || !this.rootPath || this.sessionId == null) return;
    const relevant = relativePaths.filter(isIndexRelevantPath);
    if (relevant.length === 0) return;

    const root = this.rootPath;
    const type = fileChangeType(kind);
    const changes = relevant.map((relative) => ({
      uri: fileUri(root, relative),
      type,
    }));
    try {
      await this.notify("workspace/didChangeWatchedFiles", { changes });
    } catch {
      return;
    }

    const buildFiles = relevant.filter((path) => {
      const base = path.replace(/\\/g, "/").split("/").pop() ?? path;
      return (
        base === "pom.xml" ||
        base.startsWith("build.gradle") ||
        base.startsWith("settings.gradle")
      );
    });
    for (const path of buildFiles) {
      try {
        await this.notify("java/projectConfigurationUpdate", {
          uri: fileUri(root, path),
        });
      } catch {
        // Optional on older JDT builds.
      }
    }
    if (buildFiles.length > 0) {
      this.setProgress("indexing", "updatingIndex", this.progress.percent ?? 50);
      this.startHeartbeat();
      try {
        await this.requestWithTimeout("java/buildWorkspace", false, 120_000);
      } catch {
        // ignore
      }
      this.stopHeartbeat();
      if (this.ready) this.setProgress("ready", null, 100);
    }
  }

  async request(method: string, params: unknown): Promise<unknown> {
    return this.requestWithTimeout(method, params, 120_000);
  }

  private async requestWithTimeout(
    method: string,
    params: unknown,
    timeoutMs: number,
  ): Promise<unknown> {
    if (this.sessionId == null) throw new Error("Java language server is not running");
    const id = this.nextId++;
    const result = new Promise<unknown>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
    await api.lspSend(this.sessionId, { jsonrpc: "2.0", id, method, params });
    let timer: ReturnType<typeof setTimeout> | null = null;
    try {
      return await Promise.race([
        result,
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            this.pending.delete(id);
            reject(new Error(`Language server request timed out: ${method}`));
          }, timeoutMs);
        }),
      ]);
    } finally {
      if (timer != null) clearTimeout(timer);
    }
  }

  async notify(method: string, params: unknown): Promise<void> {
    // Soft no-op when degraded (no JDK / failed start) so didChange/didClose never block editing.
    if (this.sessionId == null) return;
    await api.lspSend(this.sessionId, { jsonrpc: "2.0", method, params });
  }

  private async handleServerRequest(
    id: number | string,
    method: string,
    params: unknown,
  ): Promise<void> {
    try {
      let result: unknown = null;
      if (method === "workspace/configuration") {
        const items = (params as { items?: Array<{ section?: string }> })?.items ?? [];
        result = items.map((item) => javaConfigValue(item.section, this.javaSettings));
      } else if (method === "workspace/applyEdit") {
        result = { applied: false };
      } else if (method === "workspace/workspaceFolders") {
        if (this.rootPath) {
          result = [
            {
              uri: pathToUri(this.rootPath),
              name: this.rootPath.split(/[/\\]/).pop() ?? "workspace",
            },
          ];
        }
      }
      if (this.sessionId != null) {
        await api.lspSend(this.sessionId, { jsonrpc: "2.0", id, result });
      }
    } catch {
      if (this.sessionId != null) {
        await api.lspSend(this.sessionId, {
          jsonrpc: "2.0",
          id,
          error: { code: -32603, message: `Unhandled client request: ${method}` },
        });
      }
    }
  }

  async classFileContents(uri: string): Promise<string> {
    if (!this.rootPath) throw new Error("Java language server is not running");
    await this.ensureStarted(this.rootPath);
    const result = await this.request("java/classFileContents", { uri });
    if (typeof result !== "string") {
      throw new Error("Failed to load class file contents");
    }
    return result;
  }

  subscribe(method: string, listener: NotificationListener): () => void {
    const listeners = this.notifications.get(method) ?? new Set();
    listeners.add(listener);
    this.notifications.set(method, listeners);
    return () => listeners.delete(listener);
  }

  async stop(): Promise<void> {
    this.stopHeartbeat();
    this.clearStallWatchdog();
    this.startFailure = null;
    if (this.sessionId == null) {
      this.startPromise = null;
      this.statusCache = null;
      this.ready = false;
      this.serviceReady = false;
      this.projectReady = false;
      this.rootPath = null;
      this.setProgress("idle", null, null);
      return;
    }
    const sessionId = this.sessionId;
    try {
      if (this.ready) {
        await this.requestWithTimeout("shutdown", null, 5_000).catch(() => undefined);
        await this.notify("exit", null).catch(() => undefined);
      }
    } finally {
      await api.lspStop(sessionId);
      this.sessionId = null;
      this.rootPath = null;
      this.ready = false;
      this.serviceReady = false;
      this.projectReady = false;
      this.reusedIndex = false;
      this.startPromise = null;
      this.statusCache = null;
      this.pending.clear();
      this.unlisten?.();
      this.unlisten = null;
      this.setProgress("idle", null, null);
    }
  }
}

export const javaLspClient = new JavaLspClient();

export function pathToUri(path: string): string {
  if (isJdtUri(path)) return path;
  const normalized = path.replace(/\\/g, "/");
  // Percent-encode each path segment so non-ASCII paths (e.g. 中文目录) are valid file URIs.
  const encoded = normalized
    .split("/")
    .map((segment, index) => {
      if (segment === "" || (index === 0 && /^[A-Za-z]:$/.test(segment))) return segment;
      return encodeURIComponent(segment).replace(/%2F/gi, "/");
    })
    .join("/");
  const prefix = encoded.startsWith("/") ? "file://" : "file:///";
  return `${prefix}${encoded}`;
}

function decodeUriPath(uri: string): string {
  let raw = uri.trim();
  if (raw.startsWith("file://localhost/")) {
    raw = raw.slice("file://localhost".length);
  } else if (raw.startsWith("file:///")) {
    raw = raw.slice("file://".length);
  } else if (raw.startsWith("file://")) {
    raw = raw.slice("file://".length);
  }
  // Decode per-segment (matches encodeURIComponent in pathToUri).
  let absolute = raw
    .split("/")
    .map((segment, index) => {
      if (segment === "" || (index === 0 && /^[A-Za-z]:$/.test(segment))) return segment;
      try {
        return decodeURIComponent(segment);
      } catch {
        try {
          return decodeURI(segment);
        } catch {
          return segment;
        }
      }
    })
    .join("/");
  // Windows file:///C:/... becomes /C:/... after strip; normalize.
  absolute = absolute.replace(/^\/([A-Za-z]:)/, "$1");
  // macOS may mix NFC/NFD for CJK path segments — normalize for comparisons.
  try {
    absolute = absolute.normalize("NFC");
  } catch {
    // ignore
  }
  return absolute;
}

export function uriToPath(uri: string, rootPath: string): string {
  if (isJdtUri(uri)) return uri;
  if (!uri.startsWith("file:")) return uri;
  const absolute = decodeUriPath(uri);
  const root = rootPath
    .replace(/\\/g, "/")
    .replace(/\/$/, "")
    .normalize("NFC");
  const normalizedAbs = absolute.replace(/\\/g, "/");
  if (normalizedAbs === root) return "";
  if (normalizedAbs.startsWith(`${root}/`)) {
    return normalizedAbs.slice(root.length + 1);
  }
  // Case-insensitive prefix (APFS can vary); keep absolute if outside workspace.
  if (normalizedAbs.toLowerCase().startsWith(`${root.toLowerCase()}/`)) {
    return normalizedAbs.slice(root.length + 1);
  }
  return normalizedAbs;
}

/** Library / JDK types often come back as jdt:// or jar file URIs. */
export function isClasspathNavigationUri(uri: string): boolean {
  if (isJdtUri(uri)) return true;
  const lower = uri.toLowerCase();
  return (
    lower.startsWith("jar:file:") ||
    lower.includes(".jar!") ||
    lower.includes(".jar%21") ||
    lower.includes("/jrt-fs.jar") ||
    lower.endsWith(".class") ||
    /[?&=].*\.class/i.test(uri)
  );
}

export function fileUri(rootPath: string, relativePath: string): string {
  if (isJdtUri(relativePath)) return relativePath;
  if (relativePath.startsWith("file:")) return relativePath;
  if (relativePath.startsWith("/") || /^[A-Za-z]:[\\/]/.test(relativePath)) {
    return pathToUri(relativePath);
  }
  return pathToUri(`${rootPath.replace(/[/\\]+$/, "")}/${relativePath}`);
}
