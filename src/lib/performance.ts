export type PerformanceMetric =
  | "app.bootstrap"
  | "repo.open"
  | "git.status"
  | "project.firstPaint"
  | "log.firstPaint"
  | "file.open";

const START_PREFIX = "gitnest:start:";

/** Soft SLO ceilings in milliseconds (from docs/performance.md). */
export const PERF_SLO_MS: Record<PerformanceMetric, number | null> = {
  "app.bootstrap": 2000,
  "repo.open": 1500,
  "git.status": 200,
  "project.firstPaint": 1500,
  "log.firstPaint": null,
  "file.open": 300,
};

export type PerfReportRow = {
  metric: PerformanceMetric;
  ms: number;
  sloMs: number | null;
  pass: boolean | null;
};

export type PerfReport = {
  at: string;
  version: string;
  machine: string;
  rows: PerfReportRow[];
  markdown: string;
};

export function startMeasure(metric: PerformanceMetric): void {
  const start = `${START_PREFIX}${metric}`;
  performance.clearMarks(start);
  performance.mark(start);
}

export function endMeasure(metric: PerformanceMetric): number | null {
  const start = `${START_PREFIX}${metric}`;
  if (performance.getEntriesByName(start, "mark").length === 0) return null;

  const name = `gitnest:${metric}`;
  performance.mark(`${name}:end`);
  const measure = performance.measure(name, start, `${name}:end`);
  performance.clearMarks(start);
  performance.clearMarks(`${name}:end`);
  return measure.duration;
}

export function measuredEntries(): Record<string, number> {
  return Object.fromEntries(
    performance
      .getEntriesByType("measure")
      .filter((entry) => entry.name.startsWith("gitnest:"))
      .map((entry) => [entry.name.slice("gitnest:".length), entry.duration]),
  );
}

export function clearMeasuredEntries(): void {
  for (const entry of performance.getEntriesByType("measure")) {
    if (entry.name.startsWith("gitnest:")) {
      performance.clearMeasures(entry.name);
    }
  }
  for (const metric of Object.keys(PERF_SLO_MS) as PerformanceMetric[]) {
    performance.clearMarks(`${START_PREFIX}${metric}`);
  }
}

function round1(ms: number): number {
  return Math.round(ms * 10) / 10;
}

export function buildPerfReport(meta?: {
  version?: string;
  machine?: string;
}): PerfReport {
  const entries = measuredEntries();
  const rows: PerfReportRow[] = (Object.keys(PERF_SLO_MS) as PerformanceMetric[])
    .filter((metric) => entries[metric] != null)
    .map((metric) => {
      const ms = round1(entries[metric]!);
      const sloMs = PERF_SLO_MS[metric];
      const pass = sloMs == null ? null : ms <= sloMs;
      return { metric, ms, sloMs, pass };
    });

  const version = meta?.version ?? "dev";
  const machine = meta?.machine ?? navigator.platform;
  const at = new Date().toISOString();
  const lines = [
    "| 场景 | 指标 | 实测 (ms) | SLO (ms) | 机器 / OS | GitNest 版本 | 备注 |",
    "|------|------|-----------|----------|-----------|--------------|------|",
    ...rows.map((row) => {
      const slo = row.sloMs == null ? "—" : String(row.sloMs);
      const note =
        row.pass == null ? "UI probe" : row.pass ? "pass" : "FAIL (>SLO)";
      return `| UI probe | ${row.metric} | ${row.ms} | ${slo} | ${machine} | ${version} | ${note} |`;
    }),
  ];

  return { at, version, machine, rows, markdown: lines.join("\n") };
}

const LAST_KEY = "gitnest:perf:last";

export function persistPerfReport(report: PerfReport): void {
  try {
    localStorage.setItem(LAST_KEY, JSON.stringify(report));
  } catch {
    // ignore quota / private mode
  }
}

export function readPersistedPerfReport(): PerfReport | null {
  try {
    const raw = localStorage.getItem(LAST_KEY);
    return raw ? (JSON.parse(raw) as PerfReport) : null;
  } catch {
    return null;
  }
}
