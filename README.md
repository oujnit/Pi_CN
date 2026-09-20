<p align="center">
  <a href="https://pi.dev">
    <img alt="pi logo" src="https://pi.dev/logo-auto.svg" width="128">
  </a>
</p>
<p align="center">
  <a href="https://discord.com/invite/3cU7Bz4UPx"><img alt="Discord" src="https://img.shields.io/badge/discord-community-5865F2?style=flat-square&logo=discord&logoColor=white" /></a>
  <a href="https://www.npmjs.com/package/@earendil-works/pi-coding-agent"><img alt="npm" src="https://img.shields.io/npm/v/@earendil-works/pi-coding-agent?style=flat-square" /></a>
</p>

> [简体中文](README.md) | [English](README.en.md)

> 新贡献者的 issue 和 PR 默认会被自动关闭，维护者每天人工复查。见 [CONTRIBUTING.md](CONTRIBUTING.md)。

# Pi 智能体框架（汉化版）

本仓库是 Pi agent harness 项目的主页，包含我们的可自我扩展的编程智能体。

> **ℹ️ 本 Fork 说明**：这是 [earendil-works/pi](https://github.com/earendil-works/pi) 的非官方简体中文汉化 Fork，基于上游 `v0.85.1`。界面文案已整体汉化，功能与上游一致。汉化范围与构建方法见下方[汉化说明](#汉化说明)。

* **[@earendil-works/pi-coding-agent](packages/coding-agent)**：交互式编程智能体 CLI
* **[@earendil-works/pi-agent-core](packages/agent)**：带工具调用与状态管理的智能体运行时
* **[@earendil-works/pi-ai](packages/ai)**：统一的多供应商 LLM API（OpenAI、Anthropic、Google 等）

了解更多：

* 访问 [pi.dev](https://pi.dev)，项目官网含演示
* 阅读[官方文档](https://pi.dev/docs/latest)，也可以直接让智能体自我解释

## 全部包

| 包 | 说明 |
|---------|-------------|
| **[@earendil-works/chord](packages/chord)** | 独立的应用组合运行时，覆盖服务、复制状态、RPC 与插件 |
| **[@earendil-works/pi-telemetry](packages/telemetry)** | 供应商无关的遥测契约、参考适配器、一致性测试与类型化 schema |
| **[@earendil-works/pi-ai](packages/ai)** | 统一的多供应商 LLM API（OpenAI、Anthropic、Google 等） |
| **[@earendil-works/pi-agent-core](packages/agent)** | 带工具调用与状态管理的智能体运行时 |
| **[@earendil-works/pi-coding-agent](packages/coding-agent)** | 交互式编程智能体 CLI |
| **[@earendil-works/pi-tui](packages/tui)** | 差分渲染的终端 UI 库 |

Slack/聊天自动化与工作流见 [earendil-works/pi-chat](https://github.com/earendil-works/pi-chat)。

## 权限与容器化

Pi 不内置用于限制文件系统、进程、网络或凭据访问的权限系统。默认情况下，它以启动它的用户和进程的权限运行。

如果需要更强的边界，请将 Pi 容器化或沙箱化。参见 [packages/coding-agent/docs/containerization.md](packages/coding-agent/docs/containerization.md) 的三种模式：

- **Gondolin 扩展**：`pi` 与供应商凭据留在宿主机，把内置工具和 `!` 命令路由进本地 Linux micro-VM。
- **普通 Docker**：把整个 `pi` 进程跑在本地容器里，实现简单隔离。
- **OpenShell**：把整个 `pi` 进程跑在策略可控的沙箱中。

## 汉化说明

本 Fork 在上游源码基础上翻译了 `packages/coding-agent` 的用户界面文案，共约 **800 条**，覆盖 47 个文件：

**已汉化**

- 启动横幅与 `/hotkeys` 快捷键帮助
- 模型选择器、设置页、登录对话框、思考级别选择器、会话/会话树选择器等全部交互组件
- 斜杠命令描述、`pi --help` 全部帮助文案
- 包管理器、技能/资源加载提示、工具调用的显示标签、常用错误与状态消息

**刻意保留英文**

- 发给模型的系统提示词（翻译会降低模型工具调用质量）
- 工具名与协议字符串（`vscode_get_*` 等）、CLI 参数名、模型 ID、键位名（escape、ctrl+c）
- 术语表统一为：provider→供应商、session→会话、fork→派生、extension→扩展、skill→技能、compaction→压缩、thinking→思考

**从源码构建汉化版**

```bash
git clone https://github.com/oujnit/Pi_CN.git pi-zh && cd pi-zh
git checkout zh
npm ci

# 依次构建（上游 build 会先联网刷新模型数据，
# 而 models.dev 目录已不兼容旧 tag，因此 ai 包走 build:offline）
cd packages/chord && npm run build && cd ../tui && npm run build
cd ../telemetry && npm run build && cd ../ai && npm run build:offline && cd ../..
cd packages/agent && npm run build && cd ../session-backends/sqlite-node && npm run build
cd ../../protocol && npm run build && cd ../client && npm run build && cd ../server && npm run build
cd ../coding-agent && npm run build

# 产物在 packages/coding-agent/dist/bundle/cli.js
# 建议包一层命令，避免与官方安装的 pi 冲突：
mkdir -p ~/.local/bin && cat > ~/.local/bin/pi-zh << 'EOF'
#!/bin/zsh
exec node "/绝对路径/pi-zh/packages/coding-agent/dist/bundle/cli.js" "$@"
EOF
chmod +x ~/.local/bin/pi-zh
```

**在 Cursor / VS Code 中使用**：安装 [pi0.pi-vscode](https://github.com/pithings/pi-vscode) 扩展，在设置中加入：

```json
{ "pi-vscode.path": "/Users/<你>/.local/bin/pi-zh" }
```

之后用扩展的 "Pi: Open" 启动的就是中文界面，编辑器桥接（选中内容感知等）不受影响。**注意不要点扩展里的 "Pi: Upgrade Pi and Packages"**，它会把官方英文版装回全局。

**跟进上游更新**：

```bash
git remote add upstream https://github.com/earendil-works/pi
git fetch upstream && git merge v0.85.x   # 换成目标版本 tag
# 解决冲突后重新构建；文案翻译是源码级补丁，冲突可解
```

已知问题：上游 pre-commit 钩子会全仓类型检查，在旧 tag 上可能因 models.dev 数据漂移报错（与汉化改动无关），可 `git commit --no-verify` 跳过。

## 参与贡献

贡献指南见 [CONTRIBUTING.md](CONTRIBUTING.md)，项目规则见 [AGENTS.md](AGENTS.md)（对人和智能体都适用）。Pi 的长期规划见 [RFC](https://rfc.earendil.com/keyword/pi/)。

## 开发

```bash
npm install --ignore-scripts  # 安装全部依赖，不执行生命周期脚本
npm run build         # 刷新模型数据，然后构建所有包
npm run build:offline # 使用现有模型数据离线重建
npm run check         # Lint、格式化与类型检查
./test.sh            # 运行测试（无 API key 时跳过依赖 LLM 的测试）
./pi-test.sh         # 从源码运行 pi（可在任意目录执行）
```

## 从发布源码构建独立二进制

GitHub releases 提供版本化的源码压缩包，并有对应的 `SHA256SUMS` 校验文件。解压后运行与官方独立二进制相同的构建脚本：

```bash
VERSION="<release-version>"
tar -xzf "pi-${VERSION}-source.tar.gz"
cd "pi-${VERSION}"
./scripts/build-binaries.sh --offline-model-data --platform linux-x64 --out "$PWD/out"
```

源码压缩包内含该次发布使用的供应商模型数据快照。`--offline-model-data` 会用这份快照构建，而不是从在线目录刷新。脚本仍会安装依赖、构建 monorepo、编译 Bun 可执行文件并整理运行时资源。单独提供依赖的打包维护者可以传 `--skip-install --skip-deps`。

## 供应链加固

我们把 npm 依赖变更视同经过评审的代码变更。

- 直接外部依赖固定到精确版本；内部 workspace 包保留版本区间。
- `.npmrc` 设置 `save-exact=true` 与 `min-release-age=2`，避免 npm 解析时装到当天发布的依赖。
- `package-lock.json` 是依赖的最终依据。pre-commit 会阻止误提交 lockfile，除非设置 `PI_ALLOW_LOCKFILE_CHANGE=1`。
- `npm run check` 校验直接依赖固定、原生 TypeScript 导入兼容性，以及生成的 coding-agent shrinkwrap。
- 发布的 CLI 包附带由根 lockfile 生成的 `packages/coding-agent/npm-shrinkwrap.json`，为 npm 用户固定传递依赖。
- 发布冒烟测试用 `npm run release:local` 在仓库外构建、打包并创建隔离的 npm 和 Bun 安装。
- 本地发布安装、文档记载的 npm 安装以及 `pi update --self` 在支持时均使用 `--ignore-scripts`。
- CI 使用 `npm ci --ignore-scripts` 安装，定时 GitHub workflow 执行 `npm audit --omit=dev` 与 `npm audit signatures --omit=dev`。
- shrinkwrap 生成对依赖生命周期脚本设有显式白名单；新增带生命周期脚本的依赖未经评审前无法通过检查。

## 分享你的开源编程智能体会话

如果你用 Pi 或其他编程智能体做开源工作，请分享你的会话。

公开的 OSS 会话数据能帮助改进编程智能体——用真实任务、工具使用、失败与修复，而不是玩具基准。详见[这条 X 帖子](https://x.com/badlogicgames/status/2037811643774652911)。

发布会话用 [`badlogic/pi-share-hf`](https://github.com/badlogic/pi-share-hf)，设置方法看它的 README。你只需要一个 Hugging Face 账号、Hugging Face CLI 和 `pi-share-hf`。也可以看[这个视频](https://x.com/badlogicgames/status/2041151967695634619)，演示如何发布 `pi-mono` 会话。

作者本人会定期把 `pi-mono` 工作会话发布在这里：

- [badlogicgames/pi-mono on Hugging Face](https://huggingface.co/datasets/badlogicgames/pi-mono)

## 许可证

MIT

<p align="center">
  <a href="https://pi.dev">pi.dev</a> 域名由
  <br /><br />
  <a href="https://exe.dev"><img src="packages/coding-agent/docs/images/exy.png" alt="Exy 吉祥物" width="48" /><br />exe.dev</a>
  慷慨捐赠
</p>
