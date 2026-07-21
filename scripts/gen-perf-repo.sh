#!/usr/bin/env bash
# Generate reproducible local Git fixtures for performance measurement.
# Usage: [OUT=path] bash scripts/gen-perf-repo.sh <tiny|medium|status10k|large>
set -euo pipefail

PROFILE="${1:-}"
if [[ -z "$PROFILE" ]]; then
  echo "usage: $0 <tiny|medium|status10k|large>" >&2
  exit 2
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CACHE_ROOT="${HOME}/.cache/gitnest-fixtures"
OUT="${OUT:-$CACHE_ROOT/$PROFILE}"

case "$PROFILE" in
  tiny)
    TRACKED=50
    COMMITS=3
    IGNORED=0
    ;;
  medium)
    TRACKED=5000
    COMMITS=100
    IGNORED=0
    ;;
  status10k)
    TRACKED=10000
    COMMITS=5
    IGNORED=0
    ;;
  large)
    TRACKED=5000
    COMMITS=20
    IGNORED=95000
    ;;
  *)
    echo "unknown profile: $PROFILE" >&2
    exit 2
    ;;
esac

rm -rf "$OUT"
mkdir -p "$OUT"
cd "$OUT"

git init -q -b main
git config user.email "perf@gitnest.local"
git config user.name "GitNest Perf"

mkdir -p tracked
# Batch file creation for speed.
python3 - <<PY
from pathlib import Path
tracked = Path("tracked")
tracked.mkdir(parents=True, exist_ok=True)
n = ${TRACKED}
for i in range(n):
    sub = tracked / f"b{i // 250:04d}"
    sub.mkdir(parents=True, exist_ok=True)
    p = sub / f"f{i:05d}.txt"
    p.write_text(f"file {i}\nline two\n", encoding="utf-8")
print(f"wrote {n} tracked files")
PY

git add tracked
git commit -qm "perf: initial ${TRACKED} files"

# Spread additional commits by touching a rotating subset.
if [[ "$COMMITS" -gt 1 ]]; then
  python3 - <<PY
import subprocess
from pathlib import Path
commits = ${COMMITS} - 1
files = sorted(Path("tracked").rglob("*.txt"))
for c in range(commits):
    target = files[c % len(files)]
    with target.open("a", encoding="utf-8") as fh:
        fh.write(f"commit {c+1}\n")
    subprocess.check_call(["git", "add", str(target)])
    subprocess.check_call(["git", "commit", "-qm", f"perf: touch {c+1}"])
print(f"wrote {commits} extra commits")
PY
fi

if [[ "$IGNORED" -gt 0 ]]; then
  mkdir -p vendor/fake_modules
  cat > .gitignore <<'EOF'
vendor/fake_modules/
EOF
  python3 - <<PY
from pathlib import Path
root = Path("vendor/fake_modules")
root.mkdir(parents=True, exist_ok=True)
n = ${IGNORED}
for i in range(n):
    sub = root / f"p{i // 500:04d}"
    sub.mkdir(parents=True, exist_ok=True)
    (sub / f"m{i:05d}.js").write_text(f"module.exports = {i};\n", encoding="utf-8")
print(f"wrote {n} ignored files")
PY
  git add .gitignore
  git commit -qm "perf: ignore fake dependency tree"
fi

echo "Generated $PROFILE fixture at $OUT"
echo "tracked≈${TRACKED} commits≈${COMMITS} ignored≈${IGNORED}"
git -C "$OUT" rev-list --count HEAD
git -C "$OUT" ls-files | wc -l
