# cursor kaeru

在本机运行的 Cursor 模型网关：接住 Cursor Agent 的请求，转发到你自己配置的 OpenAI / Anthropic 兼容服务，并保留工具调用、Skills、MCP 和多轮对话。

基于 [cursor-byok](https://github.com/leookun/cursor-byok)（MIT）修改。和 Cursor 及其开发者没有关系；你连接的模型服务商可能按用量收费。

## 为什么有这个分支

上游 cursor-byok 解决了「让 Cursor 用上自己的模型」这件事，但发行版里带着广告，界面也比较杂乱。这个工程的目的很简单：

- **干净**：去掉广告和推广接口，去掉指向上游发布页的自动更新。
- **好看、好读**：重做界面，让每天开着的这个工具安静、有秩序。概览以一面贡献墙为主体，调用页是 Roadmap 风格的时间线。
- **准确**：日、小时统计按本机时区对齐，贡献墙和调用页看到的是同一天。
- **给熟人用**：不追求通用和兼容，只在小范围分发；有问题直接改，不背历史包袱。

名字里的 kaeru（帰る）是「回来」的意思：Cursor 的请求绕一圈，回到你自己的模型。

## 下载

在 [Releases](../../releases) 下载 Windows 安装包 `cursor kaeru_<版本>_x64-setup.exe`。应用不会自动更新，新版本请回到这里下载覆盖安装。

## 相对上游的改动

- 去掉广告、推广接口和自动更新。
- 界面重做：顶部导航；概览以过去一年的贡献墙为主体，大数字压印在表面上；调用页按对话分组，画成共享时间轴上的 Roadmap。
- 深色主题是近黑底；浅色主题是灰绿色的哑光底，只用一种墨色。
- 统计按本地时区分桶。
- 自带 Mona Sans、Outfit 和 HarmonyOS Sans SC 子集字体，以及一套自己的线条图标。

## 使用

1. 安装后打开应用，进入 **模型**，按提示初始化本地 CA。
2. 添加模型：填服务地址、API Key、模型名称，保存后点 **测试**。
3. 测试通过后保持应用运行，**完全退出并重启 Cursor，新开一个对话**，在模型列表里手动选择你的模型（不要选 Auto）。

### 类型与协议

| 模型系列 | 模型类型 | 请求协议 |
| --- | --- | --- |
| Claude 系列 | Anthropic | Messages API |
| GPT / OpenAI 系列 | OpenAI | Responses API |
| 其他模型 | OpenAI | Chat Completions API |

GPT 系列建议用 Responses API；Chat Completions 可能无法利用提示词缓存，更慢也更贵。

### 常用字段

- **服务器地址**：填基础地址时按协议追加标准端点；也可以填完整请求 URL，原样使用。
- **模型名称**：服务商接受的模型标识，可以用 **获取模型** 读取列表。
- **显示名称**：只影响 Cursor 模型列表里的名字。
- 自定义 Headers 和额外参数必须是 JSON 对象，只填服务商明确支持的字段。

### TAB 补全

Tab 补全走独立的 TAB 服务，在 **设置 → TAB 设置** 里选择：公益服务（上游作者部署，补全内容会发到那台服务器）、直连 Cursor 官方，或自建服务。

### 与官方账号并存

可以正常登录自己的 Cursor 账号；有官方额度时官方模型和本地模型可以混用。Auto 只会用官方模型。

## 数据流转

```text
Cursor ──Agent 请求/工具结果──▶ cursor kaeru（本机）──OpenAI/Anthropic 请求──▶ 你配置的模型 API
                                    │
                                    └─ SQLite：模型配置、API Key、调用记录（只在本机）
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

## 许可证

MIT，见 [LICENSE](./LICENSE)。
