#!/usr/bin/env node
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { renderText, traceInstructions, writeReports, type AgentKind } from "./index.js";

interface CliOptions {
  command: "trace" | "demo" | "help";
  root: string;
  target: string;
  agent: AgentKind;
  json: boolean;
  out?: string;
}

async function main(argv: string[] = process.argv.slice(2)): Promise<void> {
  const options = parseArgs(argv);
  if (options.command === "help") {
    console.log(helpText());
    return;
  }

  if (options.command === "demo") {
    const demoRoot = await createDemoWorkspace(options.out ?? path.join(process.cwd(), "reports", "demo-workspace"));
    const result = await traceInstructions({
      root: demoRoot,
      target: "src/checkout/flow.ts",
      agent: options.agent
    });
    const reportDir = path.join(process.cwd(), "reports", "demo");
    await writeReports(result, reportDir);
    console.log(renderText(result));
    console.log(`Reports written to ${reportDir}`);
    return;
  }

  const result = await traceInstructions({
    root: options.root,
    target: options.target,
    agent: options.agent
  });

  if (options.out) {
    const files = await writeReports(result, options.out);
    if (!options.json) {
      console.log(renderText(result));
      console.log(`Reports written to ${files.markdown}`);
    }
    return;
  }

  console.log(options.json ? JSON.stringify(result, null, 2) : renderText(result));
}

export function parseArgs(argv: string[]): CliOptions {
  const args = [...argv];
  const command = readCommand(args);
  let root = process.cwd();
  let target = ".";
  let agent: AgentKind = "all";
  let json = false;
  let out: string | undefined;

  while (args.length > 0) {
    const arg = args.shift();
    if (!arg) break;
    if (arg === "--help" || arg === "-h") return { command: "help", root, target, agent, json, out };
    if (arg === "--root") {
      root = requireValue(args, "--root");
    } else if (arg === "--agent") {
      agent = parseAgent(requireValue(args, "--agent"));
    } else if (arg === "--json") {
      json = true;
    } else if (arg === "--out") {
      out = requireValue(args, "--out");
    } else if (arg.startsWith("--")) {
      throw new Error(`Unknown option ${arg}`);
    } else {
      target = arg;
    }
  }

  return { command, root, target, agent, json, out };
}

function readCommand(args: string[]): CliOptions["command"] {
  const first = args[0];
  if (first === "trace" || first === "demo") {
    args.shift();
    return first;
  }
  if (first === "help" || first === "--help" || first === "-h") {
    args.shift();
    return "help";
  }
  return "trace";
}

function requireValue(args: string[], option: string): string {
  const value = args.shift();
  if (!value || value.startsWith("-")) throw new Error(`${option} requires a value`);
  return value;
}

function parseAgent(value: string): AgentKind {
  const agents = new Set(["codex", "copilot", "cursor", "claude", "anthropic", "gemini", "all"]);
  if (!agents.has(value)) {
    throw new Error(`Unknown agent ${value}. Use codex, copilot, cursor, claude, anthropic, gemini, or all.`);
  }
  return value as AgentKind;
}

async function createDemoWorkspace(root: string): Promise<string> {
  const resolved = path.resolve(root);
  await rm(resolved, { recursive: true, force: true });
  await mkdir(path.join(resolved, "src", "checkout"), { recursive: true });
  await mkdir(path.join(resolved, ".github", "instructions"), { recursive: true });

  await writeFile(
    path.join(resolved, "AGENTS.md"),
    "# Repository Agent Instructions\n\nKeep changes small and verify every command.\n",
    "utf8"
  );
  await writeFile(
    path.join(resolved, "src", "AGENTS.md"),
    "# Source Tree Instructions\n\nPrefer typed boundaries for runtime code.\n",
    "utf8"
  );
  await writeFile(
    path.join(resolved, ".github", "copilot-instructions.md"),
    "# Copilot Repository Instructions\n\nUse existing project conventions.\n",
    "utf8"
  );
  await writeFile(
    path.join(resolved, ".github", "instructions", "typescript.instructions.md"),
    "---\napplyTo: \"src/**/*.ts\"\n---\n# TypeScript Instructions\n\nUse explicit return types on exported functions.\n",
    "utf8"
  );
  await writeFile(path.join(resolved, "CLAUDE.md"), "# Claude Instructions\n\nUse the project test lane.\n", "utf8");
  await writeFile(path.join(resolved, "src", "checkout", "flow.ts"), "export const flow = 'demo';\n", "utf8");

  return resolved;
}

function helpText(): string {
  return `agent-which

Trace which AI coding-agent instruction files apply to a target path.

Usage:
  agent-which trace <target> [--root <dir>] [--agent all|codex|copilot|cursor|claude|anthropic|gemini] [--json] [--out <dir>]
  agent-which demo [--agent all|codex|copilot|cursor|claude|anthropic|gemini] [--out <workspace-dir>]

Examples:
  agent-which trace src/index.ts --agent codex
  agent-which trace src/index.ts --agent copilot --out reports/agent-which
  agent-which demo
`;
}

if (isCliEntryPoint()) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`agent-which: ${message}`);
    process.exitCode = 1;
  });
}

function isCliEntryPoint(): boolean {
  return process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
}
