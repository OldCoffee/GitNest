export type PerformanceMetric =
  | "app.bootstrap"
  | "repo.open"
  | "git.status"
  | "project.firstPaint"
  | "log.firstPaint"
  | "file.open";

const START_PREFIX = "gitnest:start:";

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

/** End a metric at most once until the next matching `startMeasure`. */
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
  for (const metric of [
    "app.bootstrap",
    "repo.open",
    "git.status",
    "project.firstPaint",
    "log.firstPaint",
    "file.open",
  ] as const) {
    performance.clearMarks(`${START_PREFIX}${metric}`);
  }
}
