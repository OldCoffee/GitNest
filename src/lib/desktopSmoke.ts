import { api } from "./api";

export type DesktopSmokeReport = {
  ok: boolean;
  version: string;
  repoPath: string;
  steps: Array<{ name: string; ok: boolean; detail?: string }>;
  error?: string;
  finishedAt: string;
};

/**
 * Drive open → edit → stage → commit → log through real Tauri IPC.
 * Used by scripts/desktop-smoke.sh (GITNEST_DESKTOP_SMOKE).
 */
export async function runDesktopSmoke(options: {
  openRepo: (path: string) => Promise<void>;
  repoPath: string;
  version?: string;
}): Promise<DesktopSmokeReport> {
  const steps: DesktopSmokeReport["steps"] = [];
  const version = options.version ?? "dev";
  const smokeName = `gitnest-desktop-smoke-${Date.now()}.txt`;
  const subject = `chore: desktop smoke ${Date.now()}`;

  const mark = (name: string, ok: boolean, detail?: string) => {
    steps.push({ name, ok, detail });
    if (!ok) {
      throw new Error(detail ?? `${name} failed`);
    }
  };

  try {
    await options.openRepo(options.repoPath);
    mark("open", true, options.repoPath);

    const smokeFile = await api.createProjectFile(null, smokeName);
    mark("create", true, smokeFile);

    const content = `GitNest desktop smoke\n${new Date().toISOString()}\n`;
    await api.writeTextFile(smokeFile, content, null, true);
    mark("write", true, smokeFile);

    await api.stageFiles([smokeFile]);
    mark("stage", true, smokeFile);

    const result = await api.commitChanges({
      subject,
      body: "",
      amend: false,
      signoff: false,
    });
    mark("commit", true, result.hash);

    const log = await api.getLog(null, 0, 20);
    const found = log.some(
      (entry) => entry.subject === subject || entry.hash === result.hash,
    );
    mark("log", found, found ? subject : "commit missing from log");

    const report: DesktopSmokeReport = {
      ok: true,
      version,
      repoPath: options.repoPath,
      steps,
      finishedAt: new Date().toISOString(),
    };
    try {
      await api.writeSmokeReport(JSON.stringify(report, null, 2));
    } catch (error) {
      console.warn("[smoke] write_smoke_report failed", error);
    }
    console.info("[gitnest desktop-smoke] ok", report);
    return report;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const report: DesktopSmokeReport = {
      ok: false,
      version,
      repoPath: options.repoPath,
      steps,
      error: message,
      finishedAt: new Date().toISOString(),
    };
    try {
      await api.writeSmokeReport(JSON.stringify(report, null, 2));
    } catch {
      // ignore secondary write failure
    }
    console.error("[gitnest desktop-smoke] failed", report);
    throw error;
  }
}
