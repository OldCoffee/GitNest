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

- 前端使用 `src/lib/performance.ts` 的 `startMeasure/endMeasure`。
- Rust 使用 `tracing` span，设置 `RUST_LOG=gitnest_app=debug,rebased_core=debug`。
- CPU 与内存继续由状态栏进程指标观察。
- CI 负责类型检查、Lint、单元测试和 Rust 静态检查；性能基准在固定机器执行，
  避免共享 CI runner 的噪声被误判为回归。

## 固定场景

1. 空工作区冷启动。
2. 小型仓库（少于 500 文件）。
3. 中型仓库（约 5,000 文件、10,000 次提交）。
4. 大型仓库（约 100,000 文件，包含 ignored 依赖目录）。
5. 同时执行 status、branch listing、diff preview 和 Log 分页。

## Phase 1 验收清单

- [x] 前端 `typecheck` / `lint` / `test` / `build`
- [x] Rust `cargo check` / `cargo test` / `cargo clippy -D warnings`
- [x] DocumentStore + CodeMirror 编辑器可用
- [x] Tab dirty / 关闭确认 / 会话恢复 / 外部修改冲突
- [x] 异步 Git 服务与短持锁
- [x] 增量 workspace 事件与精确失效
- [x] Find in Path（可取消）与文件内查找
- [x] Go to File / Go to Line / Recent Files
- [x] PTY 多终端会话创建 / write / resize / close
- [x] Java LSP 宿主（未安装 JDT LS 时不阻塞编辑与 Git）

性能 SLO 在固定机器上按「固定场景」复测；CI 负责正确性门禁，不把共享 runner 噪声当作回归。
