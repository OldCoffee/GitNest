# 开发文档

## 环境要求

- macOS、Windows 或 Linux 桌面环境。
- Node.js 20.19+ 或 22 LTS。
- npm。
- Rust 1.88.0。
- 本机安装 Git，并确保 Git 可执行文件在 PATH 中，或在设置里配置 `git_path`。

项目包含 `rust-toolchain.toml`：

```toml
[toolchain]
channel = "1.88.0"
```

在仓库根目录进入项目后，Rust 会自动使用该版本。

## 安装依赖

```bash
npm install
```

中国大陆环境可设置 npm 镜像：

```bash
npm config set registry https://registry.npmmirror.com
```

Rust 镜像可参考根 README 中的 rsproxy 配置。

## 开发启动

```bash
npm run tauri dev
```

该命令会：

1. 根据 `src-tauri/tauri.conf.json` 的 `beforeDevCommand` 启动 `npm run dev`。
2. Vite 在固定端口 `1420` 提供前端页面。
3. Tauri 启动桌面窗口并加载 `http://localhost:1420`。
4. Rust 后端命令和插件一起运行。

如果只调试前端页面，可执行：

```bash
npm run dev
```

但只运行 Vite 时无法调用真实 Tauri 后端命令。

## 构建检查

前端构建：

```bash
npm run build
```

桌面应用构建：

```bash
npm run tauri build
```

`npm run build` 实际执行：

```bash
tsc && vite build
```

提交或交付前至少应运行 `npm run build`。如果改动涉及 Rust 后端、Tauri 配置或打包能力，应运行 `npm run tauri build`。

## 测试分层

| 层 | 命令 | 覆盖 |
|----|------|------|
| Vitest（mock API） | `npm run test` / `npm run check` | 单元与编排；进 CI 三平台 |
| Playwright UI | `npm run test:e2e` | Vite + mock Tauri invoke 的 DOM 主路径；CI 仅 Ubuntu |
| Rust 真 git | `cargo test --workspace` | `rebased-core` 集成；进 CI 三平台 |
| 桌面冒烟 | `npm run smoke:desktop` | 真 Tauri IPC；本机手跑，默认不进 CI |

首次跑 E2E 需安装浏览器：`npx playwright install chromium`。

## 目录结构

```text
GitNest/
  src/                       React 前端
    components/              UI 组件
    context/                 偏好设置、主题、语言上下文
    hooks/                   React Query 和事件监听 hooks
    layout/                  主布局
    lib/                     API、类型、主题、高亮等基础能力
    pages/                   页面级组件
    store/                   Zustand 全局状态
  src-tauri/                 Tauri Rust 应用
    src/commands/            后端 command 模块
    src/lib.rs               Tauri 初始化和 command 注册
    src/state.rs             后端共享状态
    src/watcher.rs           仓库文件监听
    tauri.conf.json          Tauri 配置
    capabilities/            Tauri 权限配置
  crates/rebased-core/       Git CLI 和核心业务逻辑
  docs/                      开发者文档
```

## 前端开发约定

### 组件和状态

- 页面入口在 `src/App.tsx`。
- 主界面布局在 `src/layout/MainLayout.tsx`。
- UI 组件放在 `src/components`。
- 基础 UI 控件放在 `src/components/ui`。
- 全局 UI 状态放在 `src/store/appStore.ts`。
- 远端或后端数据优先通过 TanStack Query 管理。

不要把后端查询结果长期复制到 Zustand，除非它是明确的 UI 状态或需要跨组件临时维护。

### Tauri API

前端调用后端统一通过 `src/lib/api.ts`：

```ts
api.getStatus()
api.stageFiles(paths)
api.readTextFile(path)
```

新增 API 时：

1. 后端增加 `#[tauri::command]`。
2. 在 `src-tauri/src/lib.rs` 的 `generate_handler!` 注册。
3. 在 `src/lib/api.ts` 添加封装。
4. 在 `src/lib/types.ts` 添加或复用类型。

### 国际化

用户可切换中英文。新增用户可见文案时，应同步更新：

- `src/lib/i18n/en.ts`
- `src/lib/i18n/zh.ts`

组件中使用 `useT()` 读取文案，不要在组件里硬编码大量用户可见字符串。

### 样式

- 全局样式在 `src/index.css`。
- 项目使用 Tailwind CSS 4 和自定义 CSS 变量。
- 深色和浅色主题由 `src/lib/theme.ts` 应用。
- 新增组件样式优先沿用现有 `jb-*` 命名和 CSS 变量。

### 高亮性能

`src/lib/highlight.ts` 使用 shiki 做语法高亮。shiki 体积较大，应保持动态导入：

```ts
import("shiki")
```

不要恢复为顶层静态导入，否则会把高亮引擎和语言包放入首屏加载路径，拖慢启动。

## 后端开发约定

### 命令模块

后端命令按功能拆在 `src-tauri/src/commands`。新增命令时优先放入已有模块；只有功能边界明显不同时才新增模块。

新增模块时同步更新：

- `src-tauri/src/commands/mod.rs`
- `src-tauri/src/lib.rs`
- `src/lib/api.ts`

### AppState

后端共享状态在 `src-tauri/src/state.rs`。需要当前仓库时使用：

```rust
state.with_repo(|repo| {
    // use repo.path() and repo.git()
})
```

这样可以统一处理未打开仓库的错误。

### Git 操作

Git 逻辑优先放在 `crates/rebased-core`，Tauri 命令层只负责：

- 接收前端参数。
- 读取当前仓库和设置。
- 调用 core。
- 把错误转成 `String` 返回给前端。
- 必要时发送 Tauri 事件。

注意：解析 `git status --porcelain` 时不能对完整 stdout 调用 `trim()`，否则会破坏前导状态列。

### 文件系统操作

项目文件树相关命令在 `project.rs`。文件读写需要考虑：

- 路径必须基于当前仓库。
- 二进制文件不进入文本编辑。
- 超大文件需要限制。
- 删除目录时要谨慎处理。

### 长任务

会阻塞线程的任务应放入 `tauri::async_runtime::spawn_blocking`，例如 clone。长任务应尽量提供：

- 实时输出事件。
- 超时。
- 取消能力。
- 失败时清理策略。

## 常见功能改动入口

### 修改欢迎页

- `src/pages/WelcomePage.tsx`
- `src/hooks/useRepo.ts`
- `src/lib/api.ts`
- `src-tauri/src/commands/repo.rs`
- `src-tauri/src/commands/settings.rs`

### 修改本地变更列表

- `src/components/CommitToolWindow.tsx`
- `src/components/commit/LocalChangesTab.tsx`
- `src/components/commit/StagingAreaTab.tsx`
- `src/components/ChangesFileList.tsx`
- `src/components/ChangeContextMenu.tsx`
- `src-tauri/src/commands/status.rs`
- `crates/rebased-core`

### 修改项目树

- `src/components/ProjectToolWindow.tsx`
- `src/components/ProjectContextMenu.tsx`
- `src-tauri/src/commands/project.rs`

### 修改编辑器标签

- `src/components/EditorArea.tsx`
- `src/components/EditorTabContextMenu.tsx`
- `src/components/FileEditor.tsx`
- `src/store/appStore.ts`
- `src/lib/types.ts`

### 修改 Diff

- `src/components/DiffViewer.tsx`
- `src/components/FilePreviewView.tsx`
- `src-tauri/src/commands/diff.rs`
- `src-tauri/src/commands/preview.rs`
- `crates/rebased-core`

### 修改底部工具窗口

- `src/components/BottomToolWindow.tsx`
- `src/components/ResizableBottomPanel.tsx`
- `src/components/TerminalPanel.tsx`
- `src/components/StatusBar.tsx`
- `src/store/appStore.ts`

### 修改发布配置

- `src-tauri/tauri.conf.json`
- `src-tauri/capabilities/default.json`
- `package.json`

## 调试建议

- 前端类型错误：运行 `npm run build` 或 `npx tsc --noEmit -p tsconfig.json`。
- Vite 端口占用：检查 `1420` 端口。
- Rust 编译错误：直接看 `npm run tauri dev` 输出，Vite 配置已设置 `clearScreen: false`，不会清屏隐藏 Rust 错误。
- 后端命令失败：先确认 `src/lib/api.ts` 的命令名和 `src-tauri/src/lib.rs` 注册名一致。
- Git 操作异常：用相同参数在终端里运行本机 Git 命令对比。
