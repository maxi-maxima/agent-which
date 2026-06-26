<div align="center">

# Agent Which

**Trace which AI coding-agent instructions apply to a file.**

[![Node.js](https://img.shields.io/badge/Node.js-20%2B-brightgreen)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Agent instructions](https://img.shields.io/badge/agent%20instructions-trace-blue)]()

[简体中文](README.zh-CN.md)

</div>

AI coding agents now read guidance from many places: `AGENTS.md`, nested `AGENTS.md`, `.github/copilot-instructions.md`, `.github/instructions/*.instructions.md`, `CLAUDE.md`, `ANTHROPIC.md`, `GEMINI.md`, and Cursor rules.

When a generated change looks wrong, the first debugging question is often simple:

> Which instruction files did the agent actually see for this file?

`agent-which` answers that locally, like `git check-ignore -v` for agent instructions.

No API keys. No model calls. No telemetry.

## Documentation

| English | 简体中文 |
| --- | --- |
| [README](README.md) | [README.zh-CN](README.zh-CN.md) |
| [Changelog](CHANGELOG.md) | [更新日志](CHANGELOG.zh-CN.md) |
| [Contributing](CONTRIBUTING.md) | [贡献指南](CONTRIBUTING.zh-CN.md) |
| [Security](SECURITY.md) | [安全说明](SECURITY.zh-CN.md) |

## 30 Second Demo

```bash
npx github:maxi-maxima/agent-which demo
```

Example output:

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

The demo writes:

- `reports/demo/agent-which.json`
- `reports/demo/agent-which.md`

## Trace A File

```bash
npx github:maxi-maxima/agent-which trace src/index.ts --agent codex
```

Useful variants:

```bash
# Show Copilot's instruction chain for a path
npx github:maxi-maxima/agent-which trace src/index.ts --agent copilot

# Print machine-readable output
npx github:maxi-maxima/agent-which trace src/index.ts --agent all --json

# Write JSON and Markdown reports
npx github:maxi-maxima/agent-which trace src/index.ts --out reports/agent-which
```

Supported agents:

- `all`
- `codex`
- `copilot`
- `cursor`
- `claude`
- `anthropic`
- `gemini`

## What It Traces

| Surface | Agents | Behavior |
| --- | --- | --- |
| `AGENTS.md` | Codex, Copilot | Walks from repo root to the target path and shows the nested instruction chain. |
| `.github/copilot-instructions.md` | Copilot | Shows repository-wide Copilot custom instructions. |
| `.github/instructions/*.instructions.md` | Copilot | Reads simple `applyTo` frontmatter and reports matching files. |
| `CLAUDE.md` | Claude | Shows Claude root instructions. |
| `ANTHROPIC.md` | Anthropic | Shows Anthropic root instructions. |
| `GEMINI.md` | Gemini | Shows Gemini root instructions. |
| `.cursorrules` | Cursor | Shows legacy Cursor rules. |

## Why This Exists

The agent-instruction surface is becoming real project infrastructure:

- The open `AGENTS.md` convention describes repository instructions for coding agents and supports nested files.
- GitHub Copilot supports repository custom instructions and path-scoped `.instructions.md` files.
- More teams now mix Codex, Claude Code, Gemini CLI, Cursor, Copilot, and MCP-powered tooling in the same repo.

That creates a boring but expensive failure mode: people edit the wrong instruction file, or assume a rule applies when it does not.

`agent-which` makes the active chain visible before you debug the model.

## How This Differs From Nearby Tools

`agent-which` is not a context budget checker. Use `context-cal` when you want to keep instruction files small and focused.

`agent-which` is not an MCP server checker. Use `mcp-flightcheck` when you need to verify MCP server startup, handshakes, and tool drift.

`agent-which` answers a narrower question: for this target path and this agent, which instruction files apply?

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

## Limitations

- `applyTo` support is intentionally small and deterministic. It supports comma-separated glob strings such as `src/**/*.ts`.
- The tool does not call or emulate any coding agent.
- It does not judge instruction quality. It only traces the active files.

## Development

```bash
npm install
npm run check
node dist/cli.js demo
npm pack --dry-run --ignore-scripts
```

## Research Links

- [AGENTS.md](https://agents.md/)
- [GitHub Copilot custom instructions](https://docs.github.com/en/copilot/customizing-copilot/adding-repository-custom-instructions-for-github-copilot)
- [GitHub Copilot instruction files](https://docs.github.com/en/copilot/customizing-copilot/adding-custom-instructions-for-github-copilot)
- [Model Context Protocol](https://modelcontextprotocol.io/)

## License

MIT
