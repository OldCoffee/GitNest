# 发布文档

## 发布目标

GitNest 使用 Tauri 2 打包桌面应用。主要产物按平台包括：

| 平台 | 典型产物 |
|------|----------|
| macOS | `.app`、`.dmg`，以及 updater 压缩包 / 签名 |
| Windows | `.msi` / `.exe`（NSIS），以及 updater 产物 |
| Linux | `.deb` / AppImage 等，以及 updater 产物 |

当前 `src-tauri/tauri.conf.json` 中 **updater 已开启**（`plugins.updater.active: true`，`bundle.createUpdaterArtifacts: true`），公钥已配置。构建时必须提供私钥，否则 updater 签名阶段会失败。

本流水线**不做** Apple 公证与 Windows Authenticode；需要时可在本机或后续 CI 步骤补齐。

## CI 与自动发版

- **PR / `main` 推送**：`.github/workflows/ci.yml` 在 Ubuntu / macOS / Windows 上跑前端 `check`+`build` 与 Rust clippy/test；`cargo fmt` 仅 Ubuntu；另有 tiny 性能 fixture 生成冒烟（不测耗时）。
- **打 `v*` tag**：`.github/workflows/release.yml` 在三平台构建并用 `tauri-apps/tauri-action` 上传到 **GitHub Release 草稿**。

### 仓库 Secrets（发版前置）

在 GitHub → Settings → Secrets and variables → Actions 配置：

| Secret | 说明 |
|--------|------|
| `TAURI_SIGNING_PRIVATE_KEY` | 本机 `~/.tauri/gitnest.key` 的**文件内容**（minisign 私钥） |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | 生成密钥时的密码；无密码可留空 secret |

私钥**不要**提交到 git。

## 发布前检查

- `package.json`、`src-tauri/tauri.conf.json`、`Cargo.toml` workspace 三处 `version` 一致。
- `src-tauri/icons` 齐全。
- Secrets 已配置（若走 tag 自动发版）。
- 不含本地密钥或调试文件。

## 本机构建

```bash
export TAURI_SIGNING_PRIVATE_KEY="$(cat ~/.tauri/gitnest.key)"
# 若有密码：
# export TAURI_SIGNING_PRIVATE_KEY_PASSWORD="..."
npm run tauri build
```

也可使用 `TAURI_SIGNING_PRIVATE_KEY_PATH=~/.tauri/gitnest.key`。

Tauri 会先执行 `npm run build`，再编译 Rust 并打包。

### macOS 产物示例（Apple Silicon）

```text
target/release/bundle/macos/GitNest.app
target/release/bundle/dmg/GitNest_0.1.0_aarch64.dmg
```

## Updater

Endpoint（应用内检查更新）：

```text
https://github.com/OldCoffee/GitNest/releases/latest/download/latest.json
```

标识符：`io.github.oldcoffee.gitnest`。

### 生成签名密钥（仅首次）

```bash
npm run tauri signer generate -- -w ~/.tauri/gitnest.key
```

把终端输出的**公钥**写入 `plugins.updater.pubkey`（仓库已有一份）。私钥仅留本机 / CI Secret。

### Tag 发版流程

1. 对齐版本号并合并到 `main`。
2. `git tag v0.1.0 && git push origin v0.1.0`。
3. 等待 Release workflow；编辑并发布草稿 Release。
4. 确认 `latest.json` 与各平台 updater 资产可从 `releases/latest/download/` 访问。
5. 应用内设置页「检查更新」验证。

### 本机手动上传

若不用 workflow：本机构建后，将 `latest.json` 与签名更新包上传到对应 GitHub Release。

## 常见问题

### updater 签名失败

```text
A public key has been found, but no private key.
Make sure to set `TAURI_SIGNING_PRIVATE_KEY` environment variable.
```

- 本机：设置私钥环境变量后重试。
- CI：确认 `TAURI_SIGNING_PRIVATE_KEY` Secret 已配置。
- 临时只要安装包、不要更新包：可将 `createUpdaterArtifacts` / `updater.active` 设为 `false`（不推荐作为默认）。

### Release workflow 失败且提示签名

多半是 Secrets 未配置或私钥与仓库公钥不匹配。见 [troubleshooting.md](./troubleshooting.md)。

## 发布检查清单

- [ ] 版本号三处一致
- [ ] CI 三平台绿
- [ ] Secrets 已配置
- [ ] tag 发版或本机构建产物可用
- [ ] 安装包可打开仓库、diff、提交
- [ ] updater：`latest.json` 与签名资产可下载；设置页可检查更新
- [ ] 发布说明含版本、改动、已知问题

## 不应提交的内容

- `target/`、`dist/`、`node_modules/`
- 私钥（`*.key`）、真实 token / 凭据
- 本地性能大仓（`~/.cache/gitnest-fixtures/`、`scripts/fixtures/repos/`）
