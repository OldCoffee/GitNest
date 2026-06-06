# GitNest (Rust + Tauri)

A lightweight cross-platform Git client rebuilt with **Rust + Tauri 2 + React**.

## Features (v0.1.0)

- Open local Git repositories
- Staged / unstaged / untracked changes
- Stage, unstage, discard, commit
- File diffs (working + staged + commit)
- Commit log with virtual scrolling
- Branch checkout, create, delete
- Fetch, pull, push
- Live refresh via file watcher
- Settings in app data (no `.idea` in project root)

## Prerequisites

- **Rust 1.88.0** (required by Tauri 2.11)
- Node.js 20.19+ or 22 LTS
- Git on PATH

## 中国大陆开发环境

### 1. Rust 工具链（rsproxy 镜像）

```bash
export RUSTUP_DIST_SERVER="https://rsproxy.cn"
export RUSTUP_UPDATE_ROOT="https://rsproxy.cn/rustup"

rustup toolchain install 1.88.0 --profile minimal
```

建议写入 `~/.zshrc`：

```bash
export RUSTUP_DIST_SERVER="https://rsproxy.cn"
export RUSTUP_UPDATE_ROOT="https://rsproxy.cn/rustup"
```

项目已包含 `rust-toolchain.toml`（1.88.0）和 `.cargo/config.toml`（rsproxy sparse index）。

### 2. npm 镜像

```bash
npm config set registry https://registry.npmmirror.com
```

### 3. 构建

```bash
cd rebased-app
npm install
npm run tauri dev      # 开发
npm run tauri build    # 发布包
```

## Development

```bash
npm run tauri dev
```

## Keyboard shortcuts

| Shortcut | Action |
|----------|--------|
| Cmd/Ctrl+1 | Changes |
| Cmd/Ctrl+2 | Log |
| Cmd/Ctrl+3 | Branches |

## Architecture

```
crates/rebased-core   Git logic (git CLI)
src-tauri/            Tauri IPC + file watcher
src/                  React UI
```
