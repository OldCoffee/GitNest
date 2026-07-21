#!/usr/bin/env bash
# Measure core GitNest backend timings on a fixed machine / repo sample.
# Usage: scripts/perf-baseline.sh [repo-path] [iterations]
set -euo pipefail

REPO="${1:-.}"
ITERS="${2:-5}"
GIT="${GIT_PATH:-git}"

if [[ ! -d "$REPO/.git" && ! -f "$REPO/.git" ]]; then
  echo "error: not a git repository: $REPO" >&2
  exit 1
fi

REPO="$(cd "$REPO" && pwd)"

machine="$(uname -srm 2>/dev/null || echo unknown)"
if [[ "$(uname -s)" == "Darwin" ]]; then
  cpu="$(sysctl -n machdep.cpu.brand_string 2>/dev/null || echo unknown)"
  mem_bytes="$(sysctl -n hw.memsize 2>/dev/null || echo 0)"
  mem="$(python3 -c "print(f'{int('$mem_bytes')/1024/1024/1024:.0f} GB')" 2>/dev/null || echo unknown)"
else
  cpu="$(grep -m1 'model name' /proc/cpuinfo 2>/dev/null | cut -d: -f2- | sed 's/^ *//' || echo unknown)"
  mem="$(awk '/MemTotal/ {printf "%.0f GB", $2/1024/1024}' /proc/meminfo 2>/dev/null || echo unknown)"
fi
files="$("$GIT" -C "$REPO" ls-files 2>/dev/null | wc -l | tr -d ' ')"
commits="$("$GIT" -C "$REPO" rev-list --count HEAD 2>/dev/null || echo 0)"
version="$(git -C "$(cd "$(dirname "$0")/.." && pwd)" rev-parse --short HEAD 2>/dev/null || echo unknown)"

measure() {
  local label="$1"
  shift
  local total=0
  local i
  for ((i = 1; i <= ITERS; i++)); do
    local start end
    start=$(python3 -c 'import time; print(time.perf_counter())')
    "$@" >/dev/null
    end=$(python3 -c 'import time; print(time.perf_counter())')
    total=$(python3 -c "print($total + ($end - $start) * 1000)")
  done
  python3 -c "print(f'{($total / $ITERS):.1f}')"
}

status_ms="$(measure git.status "$GIT" -C "$REPO" status --porcelain -uall)"
log_ms="$(measure git.log "$GIT" -C "$REPO" log --oneline -n 50)"

echo "## Perf baseline sample"
echo
echo "- GitNest: \`$version\`"
echo "- Machine: $machine"
echo "- CPU: $cpu"
echo "- Memory: $mem"
echo "- Repo: \`$REPO\` ($files tracked files, $commits commits)"
echo "- Iterations: $ITERS (mean)"
echo
echo "| 场景 | 指标 | 实测 (ms) | SLO (ms) | 机器 / OS | GitNest 版本 | 备注 |"
echo "|------|------|-----------|----------|-----------|--------------|------|"
echo "| 本机仓 status | git.status (CLI) | $status_ms | 200 | $machine | $version | tracked=$files |"
echo "| 本机仓 log | git.log -n50 (CLI) | $log_ms | — | $machine | $version | commits=$commits |"
echo
echo "前端 UI 指标请在应用 DevTools 中执行："
echo '  window.__gitnestPerf?.() 或 performance.getEntriesByType("measure")'
