import { useAppStore } from "../store/appStore";
import { api } from "./api";
import {
  buildPerfReport,
  measuredEntries,
  persistPerfReport,
  type PerfReport,
} from "./performance";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => globalThis.setTimeout(resolve, ms));
}

async function waitForMetric(
  metric: string,
  timeoutMs: number,
): Promise<number | null> {
  const start = performance.now();
  while (performance.now() - start < timeoutMs) {
    const value = measuredEntries()[metric];
    if (value != null) return value;
    await sleep(50);
  }
  return measuredEntries()[metric] ?? null;
}

/**
 * Drive open → file → log and emit a SLO report (console + temp file via Tauri).
 */
export async function runUiPerfProbe(options: {
  openRepo: (path: string) => Promise<void>;
  repoPath: string;
  filePath?: string;
  version?: string;
}): Promise<PerfReport> {
  const filePath = options.filePath ?? "README.md";

  await options.openRepo(options.repoPath);
  await waitForMetric("project.firstPaint", 8_000);

  // Avoid store prefetch so FileEditor's cold load is what we measure.
  useAppStore.getState().openEditorTab({
    id: `file:${filePath}`,
    kind: "file",
    title: filePath.split(/[/\\]/).pop() ?? filePath,
    filePath,
  });
  await waitForMetric("file.open", 5_000);

  useAppStore.getState().openLogEditor();
  await waitForMetric("log.firstPaint", 8_000);
  await sleep(120);

  const report = buildPerfReport({
    version: options.version ?? "dev",
    machine: navigator.platform,
  });
  persistPerfReport(report);

  try {
    await api.writePerfReport(JSON.stringify(report, null, 2));
  } catch (error) {
    console.warn("[perf] write_perf_report failed", error);
  }

  console.info("[gitnest perf]\n" + report.markdown);
  return report;
}
