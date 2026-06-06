# 排障文档

本文件记录 GitNest 开发和打包中已经遇到过的问题、原因和处理方式。新增问题时请按“现象、原因、处理、相关文件”的结构补充。

## 启动很慢或首屏空白时间长

### 现象

- 启动应用后窗口长时间空白。
- 开发模式下 `npm run tauri dev` 体感明显慢。

### 可能原因

- 开发模式下 Vite 会按模块即时编译，首次打开比正式包慢。
- 首屏静态引入了体积较大的依赖。
- Rust 后端首次编译或重新编译耗时。
- macOS 首次打开未签名应用可能有额外安全检查。

### 已处理事项

- `src/main.tsx` 已改为立即渲染 React，再异步读取设置。
- `src/lib/highlight.ts` 中 shiki 语法高亮应保持动态导入，避免首屏加载高亮引擎、wasm 和语言包。
- `index.html` 不应放启动占位卡片，用户明确不需要额外启动页面。

### 排查方式

1. 用正式包验证真实启动速度：

   ```bash
   npm run tauri build
   ```

2. 检查构建产物中是否有大依赖进入首屏入口。
3. 检查是否把 shiki、CodeMirror 扩展或其他重型模块静态引入到首屏路径。
4. 如果只在开发模式慢，优先判断为 Vite/Rust 开发编译成本。

### 相关文件

- `src/main.tsx`
- `src/lib/highlight.ts`
- `index.html`
- `vite.config.ts`

## Vite 端口 1420 被占用

### 现象

执行 `npm run tauri dev` 时提示端口被占用。

### 原因

`vite.config.ts` 中配置：

```ts
server: {
  port: 1420,
  strictPort: true,
}
```

Tauri 开发模式依赖固定端口。如果已有 Vite 或 node 进程占用端口，启动会失败。

### 处理

macOS 下检查端口：

```bash
lsof -nP -iTCP:1420
```

结束占用进程：

```bash
kill <PID>
```

如果进程无法正常结束，再确认是否是当前正在使用的开发服务，避免误杀。

### 相关文件

- `vite.config.ts`
- `src-tauri/tauri.conf.json`

## Tauri build 最后 updater 签名失败

### 现象

构建输出中已经生成 `.app` 和 `.dmg`，但最后报错：

```text
A public key has been found, but no private key.
Make sure to set `TAURI_SIGNING_PRIVATE_KEY` environment variable.
```

### 原因

Tauri updater artifact 需要私钥签名。启用 updater 产物但没有设置 `TAURI_SIGNING_PRIVATE_KEY` 时，会在构建末尾失败。

### 处理

如果暂时不需要自动更新：

- `bundle.createUpdaterArtifacts` 设为 `false`
- `plugins.updater.active` 设为 `false`

如果需要自动更新：

1. 生成 signer key。
2. 把 public key 写入 `plugins.updater.pubkey`。
3. 构建时设置 `TAURI_SIGNING_PRIVATE_KEY`。

详细步骤见 [发布文档](./release.md)。

### 相关文件

- `src-tauri/tauri.conf.json`

## 文件存在但变更列表显示为删除或路径缺失

### 现象

- `.gitignore` 存在于磁盘上，但变更列表显示为 `gitignore`。
- 点击后提示“此文件已删除或在工作树中不可用”。
- 文件状态分类错误，例如 unstaged 被识别成 staged。

### 原因

`git status --porcelain` 的输出依赖固定列位置。第一列和第二列表示 index/worktree 状态，后面才是路径。

如果对完整 stdout 调用 `trim()`，第一行开头的空格会被删除，例如：

```text
 M .gitignore
```

会变成：

```text
M .gitignore
```

这样解析时状态列错位，路径也可能被错误截断。

### 处理

- 解析 porcelain 输出时必须保留前导空格。
- 不要对完整 stdout 使用 `trim()` 后再解析。
- 如果只需要去掉末尾换行，应使用不会影响开头空格的处理方式。

### 相关文件

- `src-tauri/src/commands/status.rs`
- `crates/rebased-core/src/git_cli.rs`
- `crates/rebased-core/src/status.rs`
- `src/components/FilePreviewView.tsx`

## 修改 Rust 后端后开发窗口没有更新

### 现象

- 修改 `src-tauri` 或 `crates/rebased-core` 后，运行中的窗口行为没有变化。
- 前端热更新正常，但 Rust 命令仍是旧逻辑。

### 可能原因

- `tauri dev` 进程已经退出。
- Vite 只处理前端热更新，Rust 侧需要 Tauri 重新编译和重启。
- 改动位于 workspace crate，触发时机不明显。

### 处理

1. 查看 `npm run tauri dev` 终端是否仍在运行。
2. 如果 Rust 改动未生效，重启 `npm run tauri dev`。
3. 可单独运行 Rust 构建确认错误：

   ```bash
   cargo build
   ```

4. 如果只是前端改动，通常不需要重启 Tauri。

### 相关文件

- `src-tauri/src`
- `crates/rebased-core`

## 克隆仓库时界面卡住或没有日志

### 现象

- 点击克隆后界面像是卡住。
- 没有实时 clone 进度。
- 无法取消。

### 设计要求

clone 应在后端阻塞线程中执行，并通过事件返回实时日志。

当前实现位于 `src-tauri/src/commands/hosting.rs`：

- 使用 `spawn_blocking` 执行 `git clone --progress`。
- 读取 stdout/stderr。
- 发送 `git-clone-output` 事件。
- 通过 `clone_id` 和 `AtomicBool` 支持取消。
- 取消后 kill 子进程并删除目标目录。

### 排查

- 前端是否监听 `git-clone-output`。
- clone 时传入的 `clone_id` 是否一致。
- 后端是否进入 `cancel_clone`。
- Git 命令是否被认证或网络问题阻塞。

### 相关文件

- `src-tauri/src/commands/hosting.rs`
- `src/lib/api.ts`
- `src/pages/WelcomePage.tsx`

## 打开系统文件夹或系统查看器无反应

### 现象

- 点击顶部文件夹名不能打开所在文件夹。
- 点击“用系统查看器打开”无反应。

### 可能原因

- Tauri opener 权限缺失。
- 传入路径不是绝对路径。
- 文件已不存在或路径被错误解析。

### 处理

检查权限配置中是否包含：

```json
"opener:allow-open-path",
"opener:allow-reveal-item-in-dir"
```

当前配置位于 `src-tauri/capabilities/default.json`。

### 相关文件

- `src-tauri/capabilities/default.json`
- `src/components/MainToolbar.tsx`
- `src/components/DiffViewer.tsx`
- `src/components/FilePreviewView.tsx`
- `src-tauri/src/commands/project.rs`

## 变更列表右键菜单被裁剪

### 现象

右键菜单只显示一部分，被左侧面板容器裁剪。

### 原因

列表容器可能使用了 `contain: strict`、overflow 或其他裁剪上下文。普通子元素菜单会被父容器限制。

### 处理

右键菜单应使用 React Portal 渲染到 `document.body`，避免被父级裁剪。

### 相关文件

- `src/components/ChangesFileList.tsx`
- `src/components/ChangeContextMenu.tsx`
- `src/index.css`

## 文本高亮导致首屏包变大

### 现象

- 构建后首屏入口包异常偏大。
- `dist/assets` 中出现大量 shiki 语言包和 wasm。
- 应用启动慢。

### 原因

如果顶层静态导入 shiki：

```ts
import { createHighlighter } from "shiki";
```

Vite 会把 shiki 相关模块纳入构建图。即使高亮只在打开文件时使用，也可能影响首屏加载。

### 处理

保持动态导入：

```ts
import("shiki").then(({ createHighlighter }) => {
  // create highlighter
});
```

### 相关文件

- `src/lib/highlight.ts`
- `src/lib/highlightView.tsx`
- `src/components/DiffViewer.tsx`
- `src/components/FilePreviewView.tsx`

## 最近打开列表异常

### 现象

- 最近打开列表重复。
- 最近打开列表过多。
- 清空最近打开后又出现旧数据。

### 当前设计

`AppState::add_recent_repo` 会：

- 删除重复路径。
- 插入到列表顶部。
- 最多保留 20 条。

清空最近打开通过 `clear_recent_repos` 实现，并保存设置。

### 排查

- 是否调用了 `save_settings` 或对应设置保存逻辑。
- 前端清空后是否刷新 `useRecentRepos` 查询。
- 是否有另一个窗口又打开了仓库并写入最近列表。

### 相关文件

- `src-tauri/src/state.rs`
- `src-tauri/src/commands/settings.rs`
- `src/hooks/useRepo.ts`
- `src/pages/WelcomePage.tsx`
