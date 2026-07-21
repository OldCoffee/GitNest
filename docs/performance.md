# GitNest 性能基线

Phase 1 使用固定硬件和固定仓库样本记录以下指标。所有结果同时记录 GitNest
版本、操作系统、CPU、内存、仓库文件数和提交数。

## SLO

- 冷启动到首屏可交互：不超过 2 秒。
- 5,000 文件仓库打开到项目树与 Git 状态可用：不超过 1.5 秒。
- 10,000 tracked files 仓库的 `git status`：p95 不超过 200 ms。
- 500 KB 文本文件打开到编辑器可输入：不超过 300 ms。
- 10,000 行文件连续输入延迟：p95 不超过 16 ms。
- 并发只读 IPC 的仓库状态锁等待：不超过 100 ms。

## 测量入口

- 前端使用 `src/lib/performance.ts` 的 `startMeasure` / `endMeasure`。
  - 已挂点：`app.bootstrap`、`repo.open`、`git.status`、`project.firstPaint`、
    `log.firstPaint`、`file.open`。
  - DevTools Console：`window.__gitnestPerf()`，或
    `performance.getEntriesByType("measure").filter(e => e.name.startsWith("gitnest:"))`。
  - 清空：`window.__gitnestPerfClear()`。
- 后端 CLI 抽样（不经过 UI）：`scripts/perf-baseline.sh [repo-path] [iterations]`。
  输出可直接粘贴进下方手测表；测的是本机 `git status` / `git log`，用于对照 SLO，
  不等于应用内 IPC 耗时。
- Rust 使用 `tracing` span（`#[tracing::instrument]` on `open_repository`、
  `get_status`、`get_log`）。设置
  `RUST_LOG=gitnest_app=debug,rebased_core=debug`。
- CPU 与内存继续由状态栏进程指标观察。
- CI 负责类型检查、Lint、单元测试和 Rust 静态检查；性能基准在固定机器执行，
  避免共享 CI runner 的噪声被误判为回归。

## 固定场景

1. 空工作区冷启动。
2. 小型仓库（少于 500 文件）。
3. 中型仓库（约 5,000 tracked；fixture 用约 100 次提交，避免生成过久）。
4. 大型仓库（约 100,000 文件，包含 ignored 依赖目录）。
5. 同时执行 status、branch listing、diff preview 和 Log 分页。

## 本地 Fixture

```bash
npm run perf:gen -- tiny        # <100 文件；CI 冒烟用
npm run perf:gen -- medium      # ~5k tracked；对齐打开 SLO
npm run perf:gen -- status10k   # ~10k tracked；对齐 status p95
npm run perf:gen -- large       # ~5k tracked + ~95k ignored
```

默认输出：`$HOME/.cache/gitnest-fixtures/<profile>`。可用 `OUT=/path` 覆盖。
大仓勿提交；`scripts/fixtures/repos/` 已 gitignore。

测量示例：

```bash
npm run perf:baseline -- "$HOME/.cache/gitnest-fixtures/medium"
npm run perf:ui -- "$HOME/.cache/gitnest-fixtures/status10k"
```

CI 仅跑 `tiny` 生成冒烟，**不**设性能阈值。

## 手测记录模板

| 场景 | 指标 | 实测 (ms) | SLO (ms) | 机器 / OS | GitNest 版本 | 备注 |
|------|------|-----------|----------|-----------|--------------|------|
| 空工作区冷启动 | app.bootstrap | 15 | 2000 | MacIntel / Darwin | 219094a | `npm run perf:ui` pass |
| 本仓打开 | repo.open | 409 | 1500 | MacIntel / Darwin | 219094a | tracked≈250；pass |
| 本仓打开 | git.status | 77 | 200 | MacIntel / Darwin | 219094a | IPC；pass |
| 本仓打开 | project.firstPaint | 438 | 1500 | MacIntel / Darwin | 219094a | pass |
| 打开 Log | log.firstPaint | 85 | — | MacIntel / Darwin | 219094a | UI probe |
| 500KB 文本 | file.open | 33 | 300 | MacIntel / Darwin | 219094a | `scripts/fixtures/perf-500kb.txt`；pass |
| 本仓 CLI 对照 | git.status (CLI) | 40.1 | 200 | Darwin 25.5.0 arm64 | 43b0a92 | tracked=250；`npm run perf:baseline` |
| 本仓 CLI 对照 | git.log -n50 (CLI) | 35.8 | — | Darwin 25.5.0 arm64 | 43b0a92 | commits=13 |
| medium fixture | repo.open | — | 1500 | （固定机填写） | — | `npm run perf:gen -- medium` |
| status10k fixture | git.status | — | 200 | （固定机填写） | — | `npm run perf:gen -- status10k` |

任何超过 SLO 20% 的回归都必须在合并前记录原因与后续措施。

## UI 自动探针

```bash
npm run perf:ui
# 或指定仓库：bash scripts/ui-perf.sh /path/to/repo
```

流程：启动 Tauri → 打开探针仓 → 打开 500KB 文件 → 打开 Log → 写出
`$TMPDIR/gitnest-ui-perf.json` 并对照 SLO。应用内也可随时执行
`window.__gitnestPerfReport()`。

Shiki 高亮：`src/lib/highlight.ts` 首屏只注册常用语言子集，其余扩展在打开文件时
`loadLanguage` 按需加载，避免一次性打进全部语言 chunk。

Query 失效：mutation / watcher 统一走 `src/lib/queryInvalidation.ts`，避免各组件重复
`invalidateQueries` 组合不一致。

Asset protocol：静态允许 `$HOME` 等基线；开仓时对当前仓库根
`allow_directory(..., recursive)`，关仓不 `forbid`（Tauri deny 永久优先于 allow）。

CodeMirror 语言包：`src/editor/languages.ts` 按扩展动态 `import()`，避免全部
`@codemirror/lang-*` 打进首屏主 chunk（与 Shiki 按需策略一致）。

可选 backlog 后量产主 chunk（`npm run build`，2026-07-21）：约 **1312 KB / gzip 391 KB**
（此前约 1596 KB / gzip 501 KB）。

## 冒烟覆盖

- 前端（mocked API）：`src/lib/workspaceSmoke.test.ts` — open → edit/save → stage/commit → log。
- Playwright UI（Vite + mock invoke）：`npm run test:e2e` / `e2e/main-path.spec.ts` — 欢迎页开仓 → stage → commit → log；CI 仅 Ubuntu。
- Rust（真实 git）：`crates/rebased-core/tests/git_loop_smoke.rs` — 同上链路，走 `rebased-core`。
- 桌面（真实 Tauri IPC）：`npm run smoke:desktop` / `scripts/desktop-smoke.sh` — 临时仓 → 开仓 → 写文件 → stage → commit → log，报告写入 `$TMPDIR/gitnest-desktop-smoke.json`。
- 设计系统：`src/index.css` 仅作入口；实现拆到 `src/styles/{tokens,base,chrome,theme-overrides,features/*}.css`（类名与拆分前一致）。

## Phase 1 验收清单

- [x] 前端 `typecheck` / `lint` / `test` / `build`
- [x] Rust `cargo check` / `cargo test` / `cargo clippy -D warnings`
- [x] DocumentStore + CodeMirror 编辑器可用
- [x] Tab dirty / 关闭确认 / 会话恢复 / 外部修改冲突
- [x] 异步 Git 服务与短持锁
- [x] 增量 workspace 事件与精确失效
- [x] Find in Path（可取消）与文件内查找
- [x] Go to File / Go to Line / Recent Files
- [x] PTY 多终端会话 create / write / resize / close
- [x] Java LSP 宿主（未安装 JDT LS 时不阻塞编辑与 Git）
- [x] 性能标记挂点与 tracing instrument（手测数值在固定机器填写上表）

性能 SLO 在固定机器上按「固定场景」复测；CI 负责正确性门禁，不把共享 runner 噪声当作回归。
