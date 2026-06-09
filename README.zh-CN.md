<div align="center">

# Agent Which

**追踪某个文件会受到哪些 AI 编码代理指令影响。**

[English](README.md)

</div>

现在的 AI 编码代理会从很多地方读取项目指令：`AGENTS.md`、嵌套 `AGENTS.md`、`.github/copilot-instructions.md`、`.github/instructions/*.instructions.md`、`CLAUDE.md`、`GEMINI.md` 和 Cursor 规则。

当一次生成结果不对时，最先要问的问题通常很简单：

> 这个文件对应的代理到底看到了哪些指令文件？

`agent-which` 用本地、可复现的方式回答这个问题。你可以把它理解成面向代理指令的 `git check-ignore -v`。

不需要 API key。不调用模型。不上传数据。没有遥测。

## 文档

| English | 简体中文 |
| --- | --- |
| [README](README.md) | [README.zh-CN](README.zh-CN.md) |
| [Changelog](CHANGELOG.md) | [更新日志](CHANGELOG.zh-CN.md) |
| [Contributing](CONTRIBUTING.md) | [贡献指南](CONTRIBUTING.zh-CN.md) |
| [Security](SECURITY.md) | [安全说明](SECURITY.zh-CN.md) |

## 30 秒演示

```bash
npx github:maxi-maxima/agent-which demo
```

示例输出：

```text
Agent Which
Root: /path/to/project/reports/demo-workspace
Target: src/checkout/flow.ts
Agent: all
Instruction files: 5

1. AGENTS.md
   agent: codex
   surface: AGENTS.md
   status: applies
   reason: Repository root AGENTS.md applies to the whole workspace.
```

演示会写入：

- `reports/demo/agent-which.json`
- `reports/demo/agent-which.md`

## 追踪一个文件

```bash
npx github:maxi-maxima/agent-which trace src/index.ts --agent codex
```

常用变体：

```bash
# 查看 Copilot 对某个路径的指令链
npx github:maxi-maxima/agent-which trace src/index.ts --agent copilot

# 输出机器可读 JSON
npx github:maxi-maxima/agent-which trace src/index.ts --agent all --json

# 写入 JSON 和 Markdown 报告
npx github:maxi-maxima/agent-which trace src/index.ts --out reports/agent-which
```

支持的代理：

- `all`
- `codex`
- `copilot`
- `cursor`
- `claude`
- `gemini`

## 会追踪什么

| 指令面 | 代理 | 行为 |
| --- | --- | --- |
| `AGENTS.md` | Codex, Copilot | 从仓库根目录走到目标路径，显示嵌套指令链。 |
| `.github/copilot-instructions.md` | Copilot | 显示仓库级 Copilot 自定义指令。 |
| `.github/instructions/*.instructions.md` | Copilot | 读取简单的 `applyTo` frontmatter，并报告匹配文件。 |
| `CLAUDE.md` | Claude | 显示 Claude 根指令。 |
| `GEMINI.md` | Gemini | 显示 Gemini 根指令。 |
| `.cursorrules` | Cursor | 显示旧版 Cursor 规则。 |

## 为什么做这个

代理指令正在变成真实的项目基础设施：

- 开放的 `AGENTS.md` 约定把自己定义成给编码代理看的仓库说明，并支持嵌套文件。
- GitHub Copilot 支持仓库级自定义指令和按路径生效的 `.instructions.md` 文件。
- 越来越多团队会在同一个仓库里混用 Codex、Claude Code、Gemini CLI、Cursor、Copilot 和 MCP 工具。

这会带来一个无聊但昂贵的问题：人们改错指令文件，或者误以为某条规则会对某个文件生效。

`agent-which` 先把当前生效链显示出来，再让你去调试模型行为。

## 与相邻工具的区别

`agent-which` 不是上下文预算检查器。想控制指令文件长度和噪声时，用 `context-cal`。

`agent-which` 不是 MCP 服务器检查器。想验证 MCP 启动、握手和工具漂移时，用 `mcp-flightcheck`。

`agent-which` 只回答一个更窄的问题：对这个目标路径和这个代理，哪些指令文件会生效？

## GitHub Action

```yaml
name: Agent Which

on:
  pull_request:

jobs:
  trace:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - name: Trace agent instructions
        run: npx github:maxi-maxima/agent-which trace src/index.ts --agent all --out reports/agent-which
```

## 限制

- `applyTo` 支持故意保持小而确定。支持 `src/**/*.ts` 这类逗号分隔 glob 字符串。
- 工具不会调用或模拟任何编码代理。
- 工具不判断指令质量，只追踪哪些文件会进入链路。

## 开发

```bash
npm install
npm run check
node dist/cli.js demo
npm pack --dry-run --ignore-scripts
```

## 调研链接

- [AGENTS.md](https://agents.md/)
- [GitHub Copilot custom instructions](https://docs.github.com/en/copilot/customizing-copilot/adding-repository-custom-instructions-for-github-copilot)
- [GitHub Copilot instruction files](https://docs.github.com/en/copilot/customizing-copilot/adding-custom-instructions-for-github-copilot)
- [Model Context Protocol](https://modelcontextprotocol.io/)

## 许可证

MIT
