# Cursor Kaeru

Cursor Kaeru 是面向 Cursor 的本地模型网关与桌面管理应用。它将 Cursor Agent 请求转发至用户配置的模型服务，支持 OpenAI 和 Anthropic 接口，并提供模型管理、调用记录与用量统计功能。

本项目基于 [cursor-byok](https://github.com/leookun/cursor-byok) 开发，主要调整桌面界面、服务商配置与统计展示。项目独立维护，与 Cursor 官方无关联。

![Cursor Kaeru 桌面界面：浅色与深色主题](docs/hero.png)

## 功能

- **模型接入**：支持 OpenAI Responses、OpenAI Chat Completions 和 Anthropic Messages 协议，以及工具调用、Skills、MCP 与多轮对话。
- **服务商管理**：采用“服务商 → 模型”的配置结构。同一服务商下的模型共享请求地址、API Key、协议与自定义 Headers；支持获取模型列表并批量添加。
- **调用记录**：在应用内查看对话与模型调用详情。
- **用量统计**：展示过去一年的 Token 用量、每日活动、对话数量、模型使用分布与活跃时段，按本机时区统计。
- **桌面界面**：提供浅色与深色主题，Windows 版本使用系统亚克力材质；接管开关位于顶栏。
- **插件账号**：展示 OAuth 账号额度，包括 Antigravity 的每周额度。

本版本移除了上游的广告、推广接口与自动更新功能。

## 安装与升级

从 [Releases](../../releases) 下载 Windows 安装包 `cursor-kaeru_<版本>_x64-setup.exe`。安装程序分两步：先选择安装位置，再选择是否创建桌面快捷方式、是否开机自启，以及界面的深浅色与语言。安装程序需要 WebView2，Windows 10/11 通常已自带。

应用不提供自动更新；安装新版本时，请手动下载并覆盖安装，配置与调用记录会保留。

### 数据库迁移

从采用旧版模型配置结构的版本升级时，应用会执行数据库迁移：根据协议、请求地址、API Key 与 Headers 合并服务商配置，并保留模型标识及调用历史。

迁移不可逆。升级前，请退出应用并备份 `~/.cursor-byok-v3/cursor-byok.db`；Windows 下对应 `%USERPROFILE%\.cursor-byok-v3\cursor-byok.db`。

## 快速开始

1. 启动应用，进入 **模型** 页面，按界面提示初始化本地 CA 证书。
2. 点击 **添加服务商**，选择预设或填写请求地址、API Key 与协议。
3. 保存服务商配置，获取模型列表并选择需要添加的模型；也可以在服务商所在行点击 **添加**，手动填写模型标识。
4. 点击模型右侧的 **测试**。测试通过后，在顶栏开启接管，并保持应用运行。
5. 完全退出并重新启动 Cursor，新建对话，在模型列表中手动选择已配置的模型。

Cursor 的 **Auto** 模式仅使用官方模型。登录 Cursor 官方账号后，可以按需切换官方模型与本地配置的模型。

## 配置说明

### 请求协议

协议在服务商级别设置，应与服务商实际提供的接口一致。常见配置如下：

| 模型系列 | 常用协议 |
| --- | --- |
| Claude | Anthropic Messages |
| GPT / OpenAI | OpenAI Responses |
| 其他兼容 OpenAI 接口的模型 | OpenAI Chat Completions |

### 配置字段

| 字段 | 说明 |
| --- | --- |
| 服务器地址 | 默认作为基础地址，应用按所选协议追加标准端点。启用“使用完整请求地址”后，直接使用填写的地址。 |
| API Key | 模型服务商提供的访问凭据，同一服务商下的模型共享此配置。 |
| 模型名称 | 服务商接受的模型标识。可通过 **获取模型列表** 读取，或手动填写。 |
| 显示名称 | 模型在 Cursor 模型列表中的显示名称。服务商名称以徽章形式显示。 |
| 自定义 Headers | 以 JSON 对象填写服务商要求的请求头。 |
| 额外参数 | 以 JSON 对象填写服务商支持的附加请求参数。 |

### Tab 补全

Tab 补全使用独立的服务配置。在 **设置 → Tab 补全** 中选择：

| 模式 | 请求去向 |
| --- | --- |
| 使用公益服务 | 上游作者部署的补全服务器。补全请求内容会发送至该服务器。 |
| 直连 | Cursor 官方补全服务。 |
| 自定义 | 用户指定的补全服务地址。 |

## 数据与请求流向

```text
Cursor
  │ Agent 请求与工具结果
  ▼
Cursor Kaeru（本机）
  ├── OpenAI / Anthropic 请求 ──▶ 已配置的模型服务
  └── SQLite 数据库
        └── 服务商配置、模型配置、API Key、对话与调用记录
```

配置与调用记录保存在本机。模型推理请求会发送至所选模型服务商；Tab 补全请求按独立配置发送至对应服务。

## 开发

### 环境要求

- Rust 稳定版工具链。
- Node.js 22 与 pnpm；pnpm 版本由 `apps/desktop/package.json` 的 `packageManager` 字段指定。
- 当前操作系统所需的 Tauri 2 构建依赖。
- 执行 `make` 命令时需要 GNU Make。

### 目录结构

```text
apps/desktop/       # 桌面前端与 Tauri 应用
apps/setup/         # Windows 安装程序：亚克力界面，内含桌面应用的 NSIS 安装包并静默运行
server/             # 本地网关、协议适配、配置与记录存储
crates/semble-core/ # 索引与搜索核心实现
protocols/cursor/   # Cursor 协议定义
support/            # 基准测试、请求采集与协议提取工具
docs/               # 项目文档资源与界面截图
```

### 安装依赖

在仓库根目录执行：

```bash
pnpm --dir apps/desktop install
```

### 启动、检查与构建

| 命令 | 用途 |
| --- | --- |
| `make dev-desktop` | 启动桌面应用开发环境。 |
| `make dev-web` | 启动前端与本地服务。 |
| `make check` | 执行 Rust 格式检查、Clippy、测试，以及前端类型检查与构建。 |
| `make build-desktop` | 构建桌面安装包；Windows 下生成安装程序 `target/release/bundle/setup/Cursor Kaeru_<版本>_x64-setup.exe`。 |

未安装 GNU Make 的 Windows 环境可以直接执行：

```bash
# 启动桌面应用开发环境
pnpm --dir apps/desktop run tauri:dev

# 构建 Windows 安装程序（先打桌面应用的 NSIS 包，再嵌入安装程序）
pnpm --dir apps/setup install
pnpm --dir apps/setup run bundle
```

### 界面演示

演示模式使用模拟数据，无需启动后端：

```bash
pnpm --dir apps/desktop exec vite --config vite.demo.config.ts
```

在 Vite 输出的本地地址下访问 `/product-demo/demo/index.html`。可附加 `?platform=windows` 或 `?theme=default-light`，指定平台样式或主题；同时指定时使用 `?platform=windows&theme=default-light`。

### 资源维护

新增中文界面文本后，重新生成中文字体子集。脚本从系统字体目录读取 HarmonyOS Sans SC：

```bash
pnpm --dir apps/desktop run fonts:cjk
```

修改服务商 Logo 列表后，重新生成图标资源：

```bash
pnpm --dir apps/desktop run logos:providers
```

概览中的价值估算采用随版本内置的模型标价。发布前可更新价格数据：

```bash
node server/scripts/model-prices.mjs
```

## 许可证与致谢

本项目采用 MIT 许可证，详见 [LICENSE](./LICENSE)。感谢 [cursor-byok](https://github.com/leookun/cursor-byok) 的维护者提供基础实现。

第三方资源来源：

- 服务商图标：[Simple Icons](https://simpleicons.org)（CC0）与 [theSVG](https://thesvg.org)（MIT）。
- 模型价格数据：[models.dev](https://models.dev)（MIT）。
- 索引与搜索实现的来源说明：[UPSTREAM.md](./UPSTREAM.md)。
