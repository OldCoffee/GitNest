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

## 1. 已完成（P3–P8）

| 里程碑 | 摘要 |
|--------|------|
| **P3** | 行级 stage / discard；`confirm_discard` |
| **P4** | commit.template 预填；commit hook 输出进 VCS Console |
| **P5** | 同窗 multi-root 工作区 MVP（多文件夹浏览/编辑，单 active Git） |
| **P6** | 多 Active Git（多 handle、`activate_git_root`、query key 按根分区） |
| **P7** | 项目树多仓只读 SCM 装饰（`get_status(repoPath?)` + 树徽章） |
| **P8** | 按根 mutation：stage / unstage / commit / discard 可选 `repoPath`；Commit 可聚焦非 active 根 |

---

## 2. 近期迭代（建议顺序）

### P9 — 按根远程与分支只读/常用写（计划中）

**目标**：branches / pull / push / fetch 等常用命令可带 `repoPath`；UI 跟随所选/active 根。

**范围建议**：

1. 为 `get_branches`、`pull`、`push`、`fetch` 及必要的 operation-state 增加可选 `repoPath`。
2. 工具栏 / 状态栏操作绑定当前 active（或用户选中的）git 根。
3. 文档与 e2e mock 同步。

**非目标**：同一窗口内对两个根同时 push；完整并行 mutation 队列。

### P10 — 多根 file watcher（计划中）

**目标**：所有已注册 git 根的工作区变更能触发对应 `status`（及项目树）刷新，不依赖仅 watch active。

**范围建议**：

1. Watcher 覆盖 workspace 内已注册 git 根（或全部 workspace roots）。
2. 事件带 `rootPath`（或可推导），前端 `invalidateQueries` 精确到根。
3. 注意性能：忽略 `.git` 噪声、防抖与现有策略对齐。

### P11 — 全命令 `repoPath` 收口（计划中）

**目标**：剩余仍隐式 `handle()` 的 Git 读/写命令统一可选 `repoPath`。

**范围建议**：

1. 盘点 `src-tauri/src/commands` 中仍只调 `handle()` 的入口（diff、log、stash、merge/rebase、冲突解决等）。
2. 统一参数约定与前端 api 封装。
3. 回归：active 缺省行为不变；显式 path 走 `handle_for` / `with_mutation_for`。

---

## 3. 中期（产品内、非多仓主线）

| ID | 主题 | 说明 |
|----|------|------|
| **T1** | 终端 UX 完善 | 多会话体验、复制/搜索/清屏、与仓库 cwd 联动、错误可见性等。 |
| **T2** | Playwright → 真 Tauri E2E | 从当前 mock 主路径，推进到可启动真窗口的关键冒烟。 |
| **T3** | 发版签名加固 | Apple 公证、Windows Authenticode；与 updater / GitHub Release 衔接。 |
| **T4** | 轻量 PR/MR 加深 | checks 摘要、本地分支关联等；**不做**完整内嵌 review。 |

---

## 4. 长期 / 边界外

| 主题 | 说明 |
|------|------|
| 完整 VS Code 级多仓 SCM 视图 | 独立 SCM 面板、每根完整变更树 |
| 全语言 LSP / 重构 / 调试器 | 超出当前产品边界；Java JDT LS 维持可选降级 |
| 完整 PR/MR review UI | 内嵌 diff review、批注、OAuth |
| 自研 Git 协议 / 凭据管理器 | 继续依赖本机 Git CLI |

---

## 5. 建议排期一览

```text
已完成:  P3 → P4 → P5 → P6 → P7 → P8
近期:    P9（按根 pull/push/fetch/branches）
         → P10（多根 watcher）
         → P11（全命令 repoPath 收口）
中期:    T1 终端 UX │ T2 真 Tauri E2E │ T3 公证/Authenticode │ T4 PR/MR 加深
长期:    完整 SCM 视图 / 全语言 LSP·调试 / 完整 review UI（边界外）
```

下一刀默认起点：**P9 — 按根远程与分支**（建议分支：`feat/p9-repo-path-remote`）。
