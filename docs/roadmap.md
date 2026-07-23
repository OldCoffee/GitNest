# 任务与路线图

本文梳理 GitNest **已完成里程碑**与**后续全部待办**，作为迭代切片的单一事实来源。产品定位与边界见 [product.md](./product.md)；发版细节见 [release.md](./release.md)。

状态约定：

| 标记 | 含义 |
|------|------|
| 已完成 | 已合入 `main`（或等价） |
| 计划中 | 下一轮可开分支交付的切片 |
| 延后 | 有价值，但依赖前置或成本高 |
| 边界外 | 明确不做或仅长期探索，不计入近期迭代 |

---

## 1. 已完成（P3–P11、T1–T2）

| 里程碑 | 摘要 |
|--------|------|
| **P3** | 行级 stage / discard；`confirm_discard` |
| **P4** | commit.template 预填；commit hook 输出进 VCS Console |
| **P5** | 同窗 multi-root 工作区 MVP（多文件夹浏览/编辑，单 active Git） |
| **P6** | 多 Active Git（多 handle、`activate_git_root`、query key 按根分区） |
| **P7** | 项目树多仓只读 SCM 装饰（`get_status(repoPath?)` + 树徽章） |
| **P8** | 按根 mutation：stage / unstage / commit / discard 可选 `repoPath`；Commit 可聚焦非 active 根 |
| **P9** | 按根远程与分支：`get_branches` / pull / push / fetch / operation-state 可选 `repoPath` |
| **P10** | 多根 file watcher：监视全部已注册 git 根；事件带 `rootPath`；按根 invalidate |
| **P11** | 全命令 `repoPath` 收口：diff/log/stash/merge/分支 mutation/冲突解决/`get_remotes` 等 |
| **T1** | 终端 UX：新建会话 cwd=`activeGitRoot`、仓库切换 remount、搜索/清屏、创建失败与 exited 可见 |
| **T2** | 真 Tauri E2E：`test:e2e:desktop` 真窗口 IPC 主路径 + 盘上 git oracle；mock Playwright 仍进 CI |

多仓主线（P5–P11）与 T1–T2 已收口。

---

## 2. 中期（产品内、非多仓主线）

| ID | 主题 | 说明 | 状态 |
|----|------|------|------|
| **T1** | 终端 UX 完善 | 多会话体验、复制/搜索/清屏、与仓库 cwd 联动、错误可见性等。 | 已完成 |
| **T2** | Playwright → 真 Tauri E2E | mock 主路径保留进 CI；真窗口关键冒烟正式化为 `test:e2e:desktop`（IPC + git oracle，本机门禁）。 | 已完成 |
| **T3** | 发版签名加固 | Apple 公证、Windows Authenticode；与 updater / GitHub Release 衔接。 | 计划中 |
| **T4** | 轻量 PR/MR 加深 | checks 摘要、本地分支关联等；**不做**完整内嵌 review。 | 计划中 |

---

## 3. 长期 / 边界外

| 主题 | 说明 |
|------|------|
| 完整 VS Code 级多仓 SCM 视图 | 独立 SCM 面板、每根完整变更树 |
| 全语言 LSP / 重构 / 调试器 | 超出当前产品边界；Java JDT LS 维持可选降级 |
| 完整 PR/MR review UI | 内嵌 diff review、批注、OAuth |
| 自研 Git 协议 / 凭据管理器 | 继续依赖本机 Git CLI |
| 双根并行 mutation 队列 | 同窗同时对两个根执行 push/merge 等 |
| Playwright 控真 Tauri 窗口 | 不做 WebDriver；真窗口车道走 IPC smoke |

---

## 4. 建议排期一览

```text
已完成:  P3 → … → P11 → T1 终端 UX → T2 真 Tauri E2E
中期:    T3 公证/Authenticode │ T4 PR/MR 加深
长期:    完整 SCM 视图 / 全语言 LSP·调试 / 完整 review UI（边界外）
```

下一刀默认起点：**T3 — 发版签名加固**（或产品优先则 **T4**）。
