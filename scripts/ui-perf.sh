#!/usr/bin/env bash
# Launch GitNest with an automated UI perf probe and print the SLO report.
# Usage: scripts/ui-perf.sh [repo-path]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REPO="${1:-$ROOT}"
REPORT="${TMPDIR:-/tmp}/gitnest-ui-perf.json"
FIXTURE_DIR="$ROOT/scripts/fixtures"
FIXTURE="$FIXTURE_DIR/perf-500kb.txt"
VERSION="$(git -C "$ROOT" rev-parse --short HEAD 2>/dev/null || echo dev)"

mkdir -p "$FIXTURE_DIR"
python3 - <<PY
from pathlib import Path
path = Path(r"$FIXTURE")
if not path.exists() or path.stat().st_size < 500_000:
    # ~500KB of line-oriented text for file.open measurement
    line = ("lorem ipsum dolor sit amet " * 4) + "\n"
    path.write_text(line * (500_000 // len(line) + 1), encoding="utf-8")
print(path, path.stat().st_size)
PY

rm -f "$REPORT"

export GITNEST_PERF_PROBE="$REPO"
export GITNEST_PERF_FILE="scripts/fixtures/perf-500kb.txt"
export GITNEST_PERF_VERSION="$VERSION"

cd "$ROOT"
echo "Starting UI perf probe on $REPO (version $VERSION)…"
echo "Waiting for $REPORT"

# Prefer an already-built debug binary when present to avoid long first compile in CI loops.
npm run tauri -- dev &
APP_PID=$!

cleanup() {
  kill "$APP_PID" 2>/dev/null || true
  wait "$APP_PID" 2>/dev/null || true
}
trap cleanup EXIT

deadline=$((SECONDS + 180))
while (( SECONDS < deadline )); do
  if [[ -f "$REPORT" ]]; then
    echo
    echo "## UI perf report"
    echo
    python3 - <<'PY'
import json, os, pathlib
path = pathlib.Path(os.environ.get("TMPDIR", "/tmp")) / "gitnest-ui-perf.json"
# also try /tmp on mac when TMPDIR is long
candidates = [path, pathlib.Path("/tmp/gitnest-ui-perf.json")]
data = None
for c in candidates:
    if c.exists():
        data = json.loads(c.read_text())
        print(f"source: {c}")
        break
if not data:
    raise SystemExit("report missing")
print(data.get("markdown", ""))
print()
fails = [r for r in data.get("rows", []) if r.get("pass") is False]
if fails:
    print("SLO failures:")
    for row in fails:
        print(f"  - {row['metric']}: {row['ms']} ms > {row['sloMs']} ms")
    raise SystemExit(1)
print("All measured metrics within SLO (or no SLO).")
PY
    exit 0
  fi
  sleep 1
done

echo "Timed out waiting for UI perf report at $REPORT" >&2
exit 1
