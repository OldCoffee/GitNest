#!/usr/bin/env bash
# Real desktop E2E (IPC): temp git repo → Tauri open → edit → stage → commit → log.
# Usage: scripts/desktop-smoke.sh  |  npm run test:e2e:desktop  |  npm run smoke:desktop
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMP_BASE="${TMPDIR:-/tmp}"
TMP_BASE="${TMP_BASE%/}"
REPORT="${TMP_BASE}/gitnest-desktop-smoke.json"
VERSION="$(git -C "$ROOT" rev-parse --short HEAD 2>/dev/null || echo dev)"
SMOKE_REPO="$(mktemp -d "$TMP_BASE/gitnest-smoke.XXXXXX")"
TIMEOUT_SECS="${GITNEST_SMOKE_TIMEOUT:-240}"
VITE_PORT="${GITNEST_SMOKE_VITE_PORT:-1420}"

free_vite_port() {
  local pids
  # Best-effort: clear a leftover Vite/Tauri from a previous smoke so `tauri dev` can bind.
  if command -v lsof >/dev/null 2>&1; then
    pids="$(lsof -tiTCP:"$VITE_PORT" -sTCP:LISTEN 2>/dev/null || true)"
    if [[ -n "${pids}" ]]; then
      echo "Port ${VITE_PORT} in use (pids: ${pids}); stopping leftovers…"
      # shellcheck disable=SC2086
      kill ${pids} 2>/dev/null || true
      sleep 1
      pids="$(lsof -tiTCP:"$VITE_PORT" -sTCP:LISTEN 2>/dev/null || true)"
      if [[ -n "${pids}" ]]; then
        # shellcheck disable=SC2086
        kill -9 ${pids} 2>/dev/null || true
        sleep 0.5
      fi
    fi
  fi
}

cleanup_repo() {
  rm -rf "$SMOKE_REPO"
}

APP_PID=""
cleanup_app() {
  if [[ -n "${APP_PID}" ]]; then
    kill "$APP_PID" 2>/dev/null || true
    wait "$APP_PID" 2>/dev/null || true
  fi
}

trap 'cleanup_app; cleanup_repo' EXIT

echo "Preparing smoke repo at $SMOKE_REPO"
git -C "$SMOKE_REPO" init -b main >/dev/null
git -C "$SMOKE_REPO" config user.name "GitNest Smoke"
git -C "$SMOKE_REPO" config user.email "smoke@gitnest.test"
git -C "$SMOKE_REPO" config commit.gpgsign false
printf '# Smoke\n' > "$SMOKE_REPO/README.md"
git -C "$SMOKE_REPO" add README.md
git -C "$SMOKE_REPO" commit -m "chore: init smoke" >/dev/null

# Avoid a stale report from a previous run / concurrent session.
rm -f "$REPORT" /tmp/gitnest-desktop-smoke.json 2>/dev/null || true
free_vite_port

export GITNEST_DESKTOP_SMOKE="$SMOKE_REPO"
export GITNEST_SMOKE_VERSION="$VERSION"
export GITNEST_SMOKE_REPO="$SMOKE_REPO"
export GITNEST_SMOKE_REPORT="$REPORT"

cd "$ROOT"
echo "Starting desktop E2E smoke (version $VERSION)…"
echo "Waiting up to ${TIMEOUT_SECS}s for report: $REPORT"

npm run tauri -- dev &
APP_PID=$!

deadline=$((SECONDS + TIMEOUT_SECS))
while (( SECONDS < deadline )); do
  if [[ -f "$REPORT" ]] || [[ -f /tmp/gitnest-desktop-smoke.json ]]; then
    # Ignore reports that belong to another smoke repo (stale concurrent run).
    if python3 - <<'PY'
import json, os, pathlib, sys
expected = os.environ["GITNEST_SMOKE_REPO"]
report_env = os.environ.get("GITNEST_SMOKE_REPORT")
candidates = []
if report_env:
    candidates.append(pathlib.Path(report_env))
candidates.append(pathlib.Path(os.environ.get("TMPDIR", "/tmp")) / "gitnest-desktop-smoke.json")
candidates.append(pathlib.Path("/tmp/gitnest-desktop-smoke.json"))
for c in candidates:
    if not c.exists():
        continue
    try:
        data = json.loads(c.read_text())
    except Exception:
        continue
    if data.get("repoPath") == expected:
        sys.exit(0)
sys.exit(1)
PY
    then
      echo
      echo "## Desktop E2E smoke report"
      echo
      python3 - <<'PY'
import json, os, pathlib, subprocess, sys

expected_repo = os.environ["GITNEST_SMOKE_REPO"]
report_env = os.environ.get("GITNEST_SMOKE_REPORT")
candidates = []
if report_env:
    candidates.append(pathlib.Path(report_env))
tmpdir = pathlib.Path(os.environ.get("TMPDIR", "/tmp"))
candidates.append(tmpdir / "gitnest-desktop-smoke.json")
candidates.append(pathlib.Path("/tmp/gitnest-desktop-smoke.json"))

report_path = None
data = None
for c in candidates:
    if not c.exists():
        continue
    try:
        candidate = json.loads(c.read_text())
    except Exception:
        continue
    if candidate.get("repoPath") == expected_repo:
        report_path = c
        data = candidate
        break

if not data or report_path is None:
    print("Desktop smoke FAILED: matching report missing", file=sys.stderr)
    raise SystemExit(1)

print(f"source: {report_path}")
print(json.dumps(data, indent=2, ensure_ascii=False))
print()

steps = data.get("steps") or []
for step in steps:
    status = "ok" if step.get("ok") else "FAIL"
    detail = step.get("detail") or ""
    print(f"  [{status}] {step.get('name')} {detail}".rstrip())

if not data.get("ok"):
    print(file=sys.stderr)
    print("Desktop smoke FAILED (in-app IPC path).", file=sys.stderr)
    print(f"  report: {report_path}", file=sys.stderr)
    print(f"  ok: {data.get('ok')}", file=sys.stderr)
    print(f"  error: {data.get('error') or 'unknown'}", file=sys.stderr)
    for step in steps:
        if not step.get("ok"):
            print(
                f"  failed step: {step.get('name')} — {step.get('detail') or ''}",
                file=sys.stderr,
            )
    raise SystemExit(1)

# Disk oracle: HEAD subject must match the smoke commit subject.
repo = expected_repo
if not pathlib.Path(repo).is_dir():
    print(f"Desktop smoke FAILED: smoke repo missing on disk: {repo}", file=sys.stderr)
    raise SystemExit(1)

subject = data.get("subject")
if not subject:
    for step in steps:
        if step.get("name") == "commit" and step.get("detail"):
            subject = step["detail"]
            break
    if not subject:
        for step in steps:
            if step.get("name") == "log" and step.get("detail"):
                subject = step["detail"]
                break

if not subject:
    print(
        "Desktop smoke FAILED: missing subject for git oracle",
        file=sys.stderr,
    )
    raise SystemExit(1)

try:
    head = subprocess.check_output(
        ["git", "-C", repo, "log", "-1", "--pretty=%s"],
        text=True,
    ).strip()
except subprocess.CalledProcessError as exc:
    print(f"Desktop smoke FAILED: git log oracle error: {exc}", file=sys.stderr)
    raise SystemExit(1) from exc

if head != subject:
    print("Desktop smoke FAILED: git log oracle mismatch.", file=sys.stderr)
    print(f"  report: {report_path}", file=sys.stderr)
    print(f"  repo: {repo}", file=sys.stderr)
    print(f"  expected subject: {subject}", file=sys.stderr)
    print(f"  git log -1:       {head}", file=sys.stderr)
    raise SystemExit(1)

print()
print(f"  [ok] git-oracle HEAD == {subject!r}")
print("Desktop E2E smoke passed (IPC + git oracle).")
PY
      exit 0
    fi
  fi
  # Bail early if tauri/vite died before writing our report.
  if ! kill -0 "$APP_PID" 2>/dev/null; then
    echo "Desktop smoke FAILED: tauri/vite exited before writing a matching report." >&2
    echo "  Expected report for repo: $SMOKE_REPO" >&2
    echo "  Tip: ensure port ${VITE_PORT} is free and \`npm run tauri -- dev\` can launch." >&2
    exit 1
  fi
  sleep 1
done

echo "Timed out waiting for desktop smoke report." >&2
echo "  Likely cause: Tauri window did not start or smoke never wrote the report." >&2
echo "  Waited: ${TIMEOUT_SECS}s" >&2
echo "  Expected report: $REPORT" >&2
echo "  Smoke repo: $SMOKE_REPO" >&2
echo "  Tip: ensure \`npm run tauri -- dev\` can launch on this machine." >&2
exit 1
