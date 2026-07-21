# GitNest 开发者文档

本目录面向后续开发者，说明 GitNest 的产品定位、架构设计、开发流程、发布流程和常见问题处理方式。文档以当前代码为准，重点帮助新成员快速找到改动入口并降低维护成本。

## 推荐阅读顺序

1. [产品文档](./product.md)：先了解 GitNest 解决什么问题、当前功能范围和主要用户流程。
2. [设计文档](./design.md)：理解 Tauri、React、Rust 后端命令、Git CLI 和文件监听之间的关系。
3. [开发文档](./development.md)：搭建环境、启动开发、定位常见功能入口。
4. [发布文档](./release.md)：打包、产物、updater 签名和发布检查。
5. [排障文档](./troubleshooting.md)：处理构建、启动、端口、文件状态和 updater 报错。

## 常用命令

在仓库根目录执行：

```bash
npm install
npm run tauri dev
npm run build
npm run tauri build
npm run smoke:desktop
```

命令说明：

- `npm run dev`：只启动 Vite 前端开发服务。
- `npm run build`：执行 TypeScript 检查并构建前端静态资源。
- `npm run tauri dev`：启动 Tauri 桌面开发模式。
- `npm run tauri build`：构建正式桌面包，macOS 下会生成 `.app` 和 `.dmg`。

## 代码入口速查

- 前端入口：`src/main.tsx`
- 应用根组件：`src/App.tsx`
- 主布局：`src/layout/MainLayout.tsx`
- Tauri API 封装：`src/lib/api.ts`
- 前端类型定义：`src/lib/types.ts`
- 全局状态：`src/store/appStore.ts`
- 后端入口：`src-tauri/src/lib.rs`
- 后端命令模块：`src-tauri/src/commands`
- Git 核心逻辑：`crates/rebased-core`
- Tauri 配置：`src-tauri/tauri.conf.json`

## 文档维护原则

- 文档应跟随功能变更同步更新。
- 不记录 `dist`、`target`、`node_modules` 等生成物内容。
- 发布、签名、密钥类信息只记录流程，不提交真实密钥。
- 如果功能尚未实现，文档中应明确标注为“未实现”或“计划中”，不要写成已完成能力。
