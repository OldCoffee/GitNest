#!/usr/bin/env bash
# Real desktop smoke: temp git repo → Tauri open → edit → stage → commit → log.
# Usage: scripts/desktop-smoke.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REPORT="${TMPDIR:-/tmp}/gitnest-desktop-smoke.json"
VERSION="$(git -C "$ROOT" rev-parse --short HEAD 2>/dev/null || echo dev)"
TMP_BASE="${TMPDIR:-/tmp}"
TMP_BASE="${TMP_BASE%/}"
SMOKE_REPO="$(mktemp -d "$TMP_BASE/gitnest-smoke.XXXXXX")"

cleanup_repo() {
  rm -rf "$SMOKE_REPO"
}
trap cleanup_repo EXIT

echo "Preparing smoke repo at $SMOKE_REPO"
git -C "$SMOKE_REPO" init -b main >/dev/null
git -C "$SMOKE_REPO" config user.name "GitNest Smoke"
git -C "$SMOKE_REPO" config user.email "smoke@gitnest.test"
git -C "$SMOKE_REPO" config commit.gpgsign false
printf '# Smoke\n' > "$SMOKE_REPO/README.md"
git -C "$SMOKE_REPO" add README.md
git -C "$SMOKE_REPO" commit -m "chore: init smoke" >/dev/null

rm -f "$REPORT"
export GITNEST_DESKTOP_SMOKE="$SMOKE_REPO"
export GITNEST_SMOKE_VERSION="$VERSION"

cd "$ROOT"
echo "Starting desktop smoke (version $VERSION)…"
echo "Waiting for $REPORT"

npm run tauri -- dev &
APP_PID=$!

cleanup_app() {
  kill "$APP_PID" 2>/dev/null || true
  wait "$APP_PID" 2>/dev/null || true
}
trap 'cleanup_app; cleanup_repo' EXIT

deadline=$((SECONDS + 240))
while (( SECONDS < deadline )); do
  if [[ -f "$REPORT" ]]; then
    echo
    echo "## Desktop smoke report"
    echo
    python3 - <<'PY'
import json, os, pathlib, sys
path = pathlib.Path(os.environ.get("TMPDIR", "/tmp")) / "gitnest-desktop-smoke.json"
candidates = [path, pathlib.Path("/tmp/gitnest-desktop-smoke.json")]
data = None
for c in candidates:
    if c.exists():
        data = json.loads(c.read_text())
        print(f"source: {c}")
        break
if not data:
    raise SystemExit("report missing")
print(json.dumps(data, indent=2, ensure_ascii=False))
print()
if not data.get("ok"):
    print("Desktop smoke FAILED:", data.get("error") or "unknown", file=sys.stderr)
    raise SystemExit(1)
for step in data.get("steps", []):
    status = "ok" if step.get("ok") else "FAIL"
    detail = step.get("detail") or ""
    print(f"  [{status}] {step.get('name')} {detail}".rstrip())
print("Desktop smoke passed.")
PY
    exit 0
  fi
  sleep 1
done

echo "Timed out waiting for desktop smoke report at $REPORT" >&2
exit 1
