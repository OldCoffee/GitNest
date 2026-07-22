# 产品文档

## 产品定位

GitNest 是一个基于 Rust、Tauri 2 和 React 的轻量级桌面 Git 客户端，并逐步补齐接近 IDE 的本地编辑与项目导航能力。它面向希望在独立桌面窗口中完成日常 Git 操作，并顺带打开/编辑项目文件的开发者。

产品目标：

- 用更轻量的桌面应用承载常用 Git 工作流。
- 提供接近 IDE 的项目树、编辑器标签页、底部工具窗口和变更列表体验。
- 保持 Git 操作可理解，关键命令结果输出到 VCS Console。
- 尽量依赖本机 Git CLI，避免自己实现复杂 Git 协议。

## 目标用户

- 日常需要查看、提交、拉取、推送、变基、合并代码的开发者。
- 希望用图形界面查看 diff、提交历史、stash、worktree 的开发者。
- 需要在多个本地仓库之间切换或多窗口打开仓库的开发者。
- 不需要完整 IDE，但希望具备文件树、文本编辑、查找与基础语言辅助的用户。

## 当前核心功能

### 仓库入口

- 打开本地文件夹。
- 检测文件夹是否为 Git 仓库。
- 非 Git 文件夹可提示初始化 Git。
- 最近打开列表。
- 清理最近打开记录。
- 同窗切换仓库（最近列表 / 打开其他）；并行多仓用新窗口。
- 同窗多文件夹工作区：可附加额外根目录到项目树并编辑文件；Git 仍绑定当前打开的仓库。
- 新窗口打开应用实例。

### 本地变更

- 查看 staged、unstaged、untracked、conflicted 文件。
- stage、unstage、stage all、unstage all。
- Diff 视图按 hunk 暂存 / 取消暂存（working / staged）。
- discard/rollback 变更。
- 提交变更。
- 右键变更文件执行常见操作：提交文件、回滚、查看 diff、新标签页查看 diff、跳转源码、删除、添加到版本控制。

### Diff 与预览

- 查看工作区 diff。
- 查看暂存区 diff。
- 查看提交 diff。
- 支持文本、图片、二进制和删除文件的预览分支。
- Markdown / 图片预览。
- 文本高亮按需加载，避免拖慢首屏。

### 分支和历史

- 查看提交日志。
- 查看本地和远端分支。
- checkout、创建、重命名、删除分支。
- 基于分支范围查看 diff。
- pull、push、fetch、merge、rebase、cherry-pick、revert、reset 等操作。

### 项目文件树与编辑

- 展示项目目录。
- 展开/收起目录。
- 定位当前文件。
- 创建、重命名、移动、复制、删除文件或目录。
- 常见文本文件可在内置编辑器中读写。
- 外部修改冲突检测、未保存关闭确认。
- Find in Path / Go to File / Go to Line / Recent Files。

### 语言辅助

- Java：可选本机 JDK + Eclipse JDT LS；未安装时降级，不阻塞编辑与 Git。
- 其他语言以编辑器语法高亮为主，不以完整语言服务为目标。

### 底部工具窗口

- Terminal（多会话 PTY；切到 VCS Console 时保活）。
- VCS Console。
- 可通过底部标签切换。
- 支持上下拖动调整底部区域高度。

### 克隆与远程

- 克隆远端仓库，显示实时日志并支持取消。
- 管理本地 remote（添加 / 修改 URL / 删除）。
- 轻量 GitHub PR / GitLab MR：列表、浏览器打开、基础创建（需在设置配置 token）。

### 设置和状态

- 主题：深色、浅色。
- 语言：英文、中文。
- Git 路径、shell 路径、默认 remote、Java/Maven/JDT LS 等设置。
- GitHub / GitLab 账号与个人访问令牌（明文写入本地 settings JSON，非系统钥匙串）。
- 状态栏显示当前进程 CPU 和内存占用。
- 自动 Fetch：设置页可配置间隔（分钟），`0` 为关闭。
- 应用内「检查更新」与滚动日志 / 诊断导出。
- 项目内设置存储等项仍可后续扩展。

## 主要用户流程

### 打开仓库

1. 用户进入欢迎页。
2. 点击打开仓库，选择任意本地文件夹。
3. 应用检测是否为 Git 仓库。
4. 如果不是 Git 仓库，提示是否初始化。
5. 打开成功后进入主界面，加载项目树、Git 状态和编辑器欢迎标签。

### 提交变更

1. 用户在 Git 工具窗口查看本地变更。
2. 选择文件并 stage。
3. 填写提交标题和描述。
4. 点击提交。
5. 后端调用 Git CLI 执行 commit。
6. 文件监听触发刷新，变更列表更新。

### 查看和编辑文件

1. 用户在项目树点击文件。
2. 前端打开 `file` 类型编辑器标签。
3. 后端读取文件内容并返回是否二进制、是否过大等信息。
4. 普通文本文件进入可编辑状态。
5. 保存时后端写回磁盘。

### 克隆仓库

1. 用户输入远端仓库 URL。
2. 应用根据 URL 推导默认目录名。
3. 用户点击克隆。
4. 后端使用 `git clone --progress`，将 stdout/stderr 通过事件实时发送给前端。
5. 用户可取消克隆，后端终止进程并清理目标目录。

## 产品边界

当前不以完整 IDE 为目标：

- 不提供全语言 LSP、复杂重构或调试器。
- 不替代 GitHub/GitLab 网页上的完整 PR/MR 协作（无 review、checks、内嵌 diff、OAuth）。
- 不内置 SSH key、凭据管理器或自定义 Git 认证流程；托管 token 仅本地明文存储。
- 不实现自己的 Git 存储协议，Git 操作主要通过本机 Git CLI。
- 不保证二进制和超大文件可编辑。

## 后续可扩展方向

### P3（已完成）

在已有 hunk stage（P1）之上继续加深 Git 工作流：

1. **行级 stage / 更细粒度 diff 交互**：选中增减行 stage/unstage、丢弃所选/整块；选中子集 stage 后刷新即自然拆块。
2. **确认策略**：`settings.confirm_discard` 控制文件/块/行 discard 是否弹确认（stage/unstage 不弹）。

### P4（已完成）

提交模板预填与 commit hook 反馈：

1. **提交模板**：读取 `git config commit.template`，在 CommitPanel 为空时预填（首行 → subject，其余 → body）；用户已编辑则不覆盖。
2. **Hook 反馈**：`git commit` 的 stdout/stderr（含 hook）写入 VCS Console；失败时面板 InlineAlert 仍显示短摘要。

### P5（已完成）

同窗 multi-root 工作区 MVP（浏览/编辑多文件夹，单 active Git）：

1. **多根目录**：`WorkspaceService` 支持多个根；可添加/移除附加文件夹（拒绝嵌套）；asset scope 覆盖各根。
2. **项目树**：多根时按根展示森林；附加根文件以绝对路径打开；Git/LSP/commit 仍只作用于当前仓库。
3. **会话**：附加根随仓库 session 持久化；换仓/关仓清空。

### P6（已完成）

同窗多 Active Git：

1. **多 handle**：`GitService` 可为多个 git 根注册 handle；`activate_git_root` 切换 active 并将该根提升为 workspace roots[0]。
2. **跟随 active**：status / stage / commit / push / branches 仍走当前 active；query key 按 `activeGitRoot` 分区。
3. **UI**：项目树 git 根可「设为 Active Git」；附加 git 文件夹时注册但不自动切换。

### P7（已完成）

项目树多仓只读 SCM 装饰：

1. **按根读 status**：`get_status(repoPath?)` 可读取任意已注册 git 根；缺省仍为 active。
2. **树徽章**：所有已注册 git 根在项目树上显示文件/目录变更徽章（M/A/D 等）；目录因子路径 dirty 而聚合为 modified。
3. **非目标（仍 backlog）**：非 active 根上的 stage/commit/push、并行 mutation、全命令 `repoPath`、多根 file watcher。

其余项保持 backlog：

- 并行多仓 mutation / 全命令 `repoPath` / 非 active 根 watcher。
- 更完善的终端交互能力。
- Apple 公证 / Windows Authenticode 与完整跨平台签名发版。
- Playwright → 真 Tauri 窗口 E2E；完整 PR/MR review UI；更多 LSP/调试器（超出当前产品边界）。
