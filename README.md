# Cursor Kaeru

在本机运行的 Cursor 模型网关：接住 Cursor Agent 的请求，转发到你自己配置的 OpenAI / Anthropic 兼容服务，并保留工具调用、Skills、MCP 和多轮对话。

这是 [cursor-byok](https://github.com/leookun/cursor-byok)（MIT）的一个个人改版，和 Cursor 及其开发者没有关系；你连接的模型服务商可能按用量收费。

## 先说上游

所有真正难的部分都来自 cursor-byok：对 Cursor 协议的解析与还原、工具调用与多轮对话的保持、Skills 和 MCP 的支持、OpenAI / Anthropic 两套协议的适配、本地 CA、插件运行时，以及完整的调用记录。

我用下来的感受是，这个项目功能已经相当完整，日常使用没有留下需要我来修的缺口。这个改版没有改动这些核心能力的行为，只是在它之上，按我自己的使用习惯和审美重新整理了界面与一部分配置方式。如果你只想要一个稳妥可靠的 BYOK 网关，直接用上游即可；如果你也喜欢这里的样子，欢迎试试。

## 这个改版是什么

它不是对上游的“美化”，而是一次符合个人审美的改版：每天都开着的工具，我希望它安静、有秩序，信息排得整齐。所以取舍都很主观，不同的人可能有不同的看法。

- **版式**：瑞士风格的 12 栏网格，粗线分区块、细线分行；窗口用 Windows 的系统磨砂材质，左侧一盏暖色的光。
- **概览**：过去一年的 Token 总量刻在玻璃上，数字会从上次看到的值滚动到现在的值；下面是贡献墙、对话数、最常用模型、最忙时段和各模型的占比。
- **顶栏**：接管开关放在顶栏里，一次点击开关，不用跳转页面。
- **模型**：改成“服务商 → 模型”两层。地址、API Key、协议和 Headers 挂在服务商上，只填一次；可以从服务商的模型列表里一次勾选多个模型。常见服务商会按名称、地址或模型名自动配上单色 logo。
- **调用**：详情直接在应用内打开，按对话分组的时间线保留。
- **插件**：OAuth 账号可以看到额度（Antigravity 含每周额度）。
- **清理**：去掉广告、推广接口，以及指向上游发布页的自动更新。
- **细节**：日、小时统计按本机时区对齐；自带 Mona Sans、Outfit 和 HarmonyOS Sans SC 子集字体，以及一套自己的线条图标。
- 深色和浅色两套主题，都以同一盏暖光为基调。

名字里的 kaeru（帰る）是“回来”的意思：Cursor 的请求绕一圈，回到你自己的模型。

## 下载

在 [Releases](../../releases) 下载 Windows 安装包 `Cursor Kaeru_<版本>_x64-setup.exe`。应用不会自动更新，新版本请回到这里下载覆盖安装。

> 数据库有一次结构升级：旧的模型配置会自动合并成服务商加模型，模型的标识不变，Cursor 里已选好的模型和调用历史都不受影响。升级后不能回退到旧版，介意的话，安装前先备份 `~/.cursor-byok-v3/cursor-byok.db`。

## 使用

1. 安装后打开应用，进入 **模型**，按提示初始化本地 CA。
2. 点 **添加服务商**：选一个常用预设，或填服务器地址和 API Key；保存后会弹出它的模型列表，勾选要用的模型。也可以在服务商一行点 **添加**，手动填模型名称。
3. 点模型右侧的 **测试**，通过后在顶栏打开 **接管**。
4. 保持应用运行，**完全退出并重启 Cursor，新开一个对话**，在模型列表里手动选择你的模型（不要选 Auto）。

### 类型与协议

| 模型系列 | 请求协议 |
| --- | --- |
| Claude 系列 | Anthropic Messages |
| GPT / OpenAI 系列 | OpenAI Responses |
| 其他模型 | OpenAI Chat Completions |

GPT 系列建议用 Responses API；Chat Completions 可能无法利用提示词缓存，更慢也更贵。协议属于服务商，同一个服务商下的模型共用。

### 常用字段

- **服务器地址**：填基础地址时按协议追加标准端点；也可以勾选“使用完整请求地址”，原样使用。
- **模型名称**：服务商接受的模型标识，可以用 **获取模型列表** 读取。
- **显示名称**：只影响 Cursor 模型列表里的名字；服务商的名称会显示成模型旁边的徽章。
- 自定义 Headers 和额外参数必须是 JSON 对象，只填服务商明确支持的字段。

### TAB 补全

Tab 补全走独立的 TAB 服务，在 **设置 → TAB 设置** 里选择：公益服务（上游作者部署，补全内容会发到那台服务器）、直连 Cursor 官方，或自建服务。

### 与官方账号并存

可以正常登录自己的 Cursor 账号；有官方额度时官方模型和本地模型可以混用。Auto 只会用官方模型。

## 数据流转

```text
Cursor ──Agent 请求/工具结果──▶ Cursor Kaeru（本机）──OpenAI/Anthropic 请求──▶ 你配置的模型 API
                                    │
                                    └─ SQLite：服务商与模型配置、API Key、调用记录（只在本机）
```

## 开发

需要 Rust、Node.js 22 + pnpm、Tauri 2 的系统依赖。

```bash
pnpm --dir apps/desktop install
```

```bash
make dev-desktop     # 启动桌面应用
make dev-web         # 只启动前端 + 本地服务
make check           # fmt + clippy + 测试 + 前端类型检查与构建
make build-desktop   # 打包（Windows 为 NSIS 安装包）
```

没有 `make` 的 Windows 环境可以直接运行：

```bash
pnpm --dir apps/desktop exec tauri build --bundles nsis
```

界面演示（带模拟数据，不需要后端）：

```bash
pnpm --dir apps/desktop exec vite --config vite.demo.config.ts
```

打开 `/product-demo/demo/index.html`，可加 `?platform=windows`、`?theme=default-light`。

新增中文界面文字后，重新生成内置中文字体子集（从系统字体目录读取 HarmonyOS Sans SC）：

```bash
pnpm --dir apps/desktop run fonts:cjk
```

服务商 logo 来自 Iconify 图标集，改动列表后重新生成：

```bash
pnpm --dir apps/desktop run logos:providers
```

## 致谢与许可证

感谢 [cursor-byok](https://github.com/leookun/cursor-byok) 的作者和贡献者。logo 取自 [Simple Icons](https://simpleicons.org)（CC0）和 [theSVG](https://thesvg.org)（MIT）。

本项目以 MIT 许可证发布，见 [LICENSE](./LICENSE)。
