import { access, mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

export type AgentKind = "codex" | "copilot" | "cursor" | "claude" | "gemini" | "all";

export interface TraceOptions {
  root: string;
  target: string;
  agent?: AgentKind;
}

export interface InstructionMatch {
  path: string;
  surface: string;
  agent: Exclude<AgentKind, "all">;
  applies: boolean;
  reason: string;
}

export interface TraceSummary {
  total: number;
  applies: number;
  skipped: number;
  byAgent: Record<Exclude<AgentKind, "all">, number>;
}

export interface TraceResult {
  root: string;
  target: string;
  agent: AgentKind;
  matches: InstructionMatch[];
  summary: TraceSummary;
}

export interface ReportFiles {
  json?: string;
  markdown?: string;
}

const AGENT_ORDER: Array<Exclude<AgentKind, "all">> = ["codex", "copilot", "cursor", "claude", "gemini"];

export async function traceInstructions(options: TraceOptions): Promise<TraceResult> {
  const root = path.resolve(options.root);
  const agent = options.agent ?? "all";
  const target = normalizeTarget(root, options.target);
  const matches: InstructionMatch[] = [];

  matches.push(...(await findScopedAgentsFiles(root, target, agent)));
  matches.push(...(await findRootAgentFiles(root, agent)));
  matches.push(...(await findCopilotInstructionFiles(root, target, agent)));
  matches.sort((left, right) => {
    const byPriority = surfacePriority(left) - surfacePriority(right);
    if (byPriority !== 0) return byPriority;
    const byPath = left.path.localeCompare(right.path);
    if (byPath !== 0) return byPath;
    return AGENT_ORDER.indexOf(left.agent) - AGENT_ORDER.indexOf(right.agent);
  });

  return {
    root,
    target,
    agent,
    matches,
    summary: summarizeMatches(matches)
  };
}

export async function writeReports(result: TraceResult, outDir: string): Promise<ReportFiles> {
  const resolved = path.resolve(outDir);
  await mkdir(resolved, { recursive: true });
  const json = path.join(resolved, "agent-which.json");
  const markdown = path.join(resolved, "agent-which.md");
  await writeFile(json, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  await writeFile(markdown, renderMarkdown(result), "utf8");
  return { json, markdown };
}

export function renderText(result: TraceResult): string {
  const lines = [
    "Agent Which",
    `Root: ${result.root}`,
    `Target: ${slash(result.target)}`,
    `Agent: ${result.agent}`,
    `Instruction files: ${result.summary.total}`,
    `Applies: ${result.summary.applies}`,
    `Skipped: ${result.summary.skipped}`,
    `By agent: ${formatAgentCounts(result.summary.byAgent)}`,
    ""
  ];

  if (result.matches.length === 0) {
    lines.push("No matching instruction files found.");
  } else {
    result.matches.forEach((match, index) => {
      const status = match.applies ? "applies" : "skipped";
      lines.push(`${index + 1}. ${slash(path.relative(result.root, match.path) || match.path)}`);
      lines.push(`   agent: ${match.agent}`);
      lines.push(`   surface: ${match.surface}`);
      lines.push(`   status: ${status}`);
      lines.push(`   reason: ${match.reason}`);
    });
  }

  return `${lines.join("\n")}\n`;
}

export function renderMarkdown(result: TraceResult): string {
  const rows = result.matches
    .map((match, index) => {
      const relative = slash(path.relative(result.root, match.path) || match.path);
      return `| ${index + 1} | \`${relative.replaceAll("|", "\\|")}\` | ${match.agent} | ${match.surface} | ${
        match.applies ? "applies" : "skipped"
      } | ${match.reason.replaceAll("|", "\\|")} |`;
    })
    .join("\n");

  return `# Agent Which Report

| Field | Value |
| --- | --- |
| Root | \`${result.root}\` |
| Target | \`${slash(result.target)}\` |
| Agent | \`${result.agent}\` |
| Instruction files | ${result.summary.total} |
| Applies | ${result.summary.applies} |
| Skipped | ${result.summary.skipped} |
| By agent | ${formatAgentCounts(result.summary.byAgent)} |

## Instruction Chain

| # | File | Agent | Surface | Status | Reason |
| --- | --- | --- | --- | --- | --- |
${rows || "| - | - | - | - | - | No matching instruction files found. |"}
`;
}

async function findScopedAgentsFiles(root: string, target: string, agent: AgentKind): Promise<InstructionMatch[]> {
  if (!agentMatches(agent, "codex") && !agentMatches(agent, "copilot")) return [];

  const targetPath = path.resolve(root, target);
  const targetInfo = await safeStat(targetPath);
  let current = targetInfo?.isDirectory() ? targetPath : path.dirname(targetPath);
  const matches: InstructionMatch[] = [];

  while (isInsideOrEqual(root, current)) {
    const agentsPath = path.join(current, "AGENTS.md");
    if (await fileExists(agentsPath)) {
      const relativeDir = path.relative(root, current);
      matches.push({
        path: agentsPath,
        surface: "AGENTS.md",
        agent: agentMatches(agent, "codex") ? "codex" : "copilot",
        applies: true,
        reason:
          relativeDir === ""
            ? "Repository root AGENTS.md applies to the whole workspace."
            : `Nearest ancestor AGENTS.md applies under ${slash(relativeDir)}.`
      });
    }
    if (current === root) break;
    current = path.dirname(current);
  }

  return matches.reverse();
}

async function findRootAgentFiles(root: string, agent: AgentKind): Promise<InstructionMatch[]> {
  const surfaces: Array<{ file: string; agent: Exclude<AgentKind, "all">; reason: string }> = [
    {
      file: "CLAUDE.md",
      agent: "claude",
      reason: "Claude Code root instructions apply when Claude is the selected agent."
    },
    {
      file: "GEMINI.md",
      agent: "gemini",
      reason: "Gemini root instructions apply when Gemini is the selected agent."
    },
    {
      file: ".cursorrules",
      agent: "cursor",
      reason: "Legacy Cursor rules apply to Cursor sessions."
    }
  ];

  const matches: InstructionMatch[] = [];
  for (const surface of surfaces) {
    if (!agentMatches(agent, surface.agent)) continue;
    const candidate = path.join(root, surface.file);
    if (await fileExists(candidate)) {
      matches.push({
        path: candidate,
        surface: surface.file,
        agent: surface.agent,
        applies: true,
        reason: surface.reason
      });
    }
  }
  return matches;
}

async function findCopilotInstructionFiles(
  root: string,
  target: string,
  agent: AgentKind
): Promise<InstructionMatch[]> {
  if (!agentMatches(agent, "copilot")) return [];

  const matches: InstructionMatch[] = [];
  const rootInstruction = path.join(root, ".github", "copilot-instructions.md");
  if (await fileExists(rootInstruction)) {
    matches.push({
      path: rootInstruction,
      surface: ".github/copilot-instructions.md",
      agent: "copilot",
      applies: true,
      reason: "Repository custom instructions apply to Copilot."
    });
  }

  const instructionsDir = path.join(root, ".github", "instructions");
  const instructionFiles = await walkInstructionFiles(instructionsDir);
  for (const instructionPath of instructionFiles) {
    const content = await readFile(instructionPath, "utf8");
    const applyTo = parseApplyTo(content);
    const applies = applyTo.length === 0 || applyTo.some((pattern) => globMatches(pattern, slash(target)));
    matches.push({
      path: instructionPath,
      surface: ".github/instructions/*.instructions.md",
      agent: "copilot",
      applies,
      reason: applies
        ? applyTo.length > 0
          ? `Matched applyTo pattern ${applyTo.join(", ")}.`
          : "No applyTo frontmatter was found, so the instruction is treated as repository-wide."
        : `Skipped because applyTo pattern ${applyTo.join(", ")} does not match ${slash(target)}.`
    });
  }

  return matches.filter((match) => match.applies || agent === "all");
}

async function walkInstructionFiles(root: string): Promise<string[]> {
  if (!(await fileExists(root))) return [];
  const entries = await readdir(root, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const absolute = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkInstructionFiles(absolute)));
    } else if (entry.isFile() && entry.name.endsWith(".instructions.md")) {
      files.push(absolute);
    }
  }
  return files.sort((left, right) => left.localeCompare(right));
}

function parseApplyTo(content: string): string[] {
  if (!content.startsWith("---")) return [];
  const end = content.indexOf("\n---", 3);
  if (end === -1) return [];
  const frontmatter = content.slice(3, end);
  const match = frontmatter.match(/^applyTo:\s*(.+)$/m);
  if (!match) return [];
  return match[1]
    .split(",")
    .map((value) => value.trim().replace(/^["']|["']$/g, ""))
    .filter(Boolean);
}

function globMatches(pattern: string, target: string): boolean {
  const globstar = "__AGENT_WHICH_GLOBSTAR__";
  const escaped = slash(pattern)
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, globstar)
    .replace(/\*/g, "[^/]*")
    .replaceAll(globstar, ".*");
  return new RegExp(`^${escaped}$`).test(target);
}

function normalizeTarget(root: string, target: string): string {
  const absolute = path.isAbsolute(target) ? path.resolve(target) : path.resolve(root, target);
  if (!isInsideOrEqual(root, absolute)) {
    throw new Error(`Target ${target} is outside root ${root}`);
  }
  return path.relative(root, absolute) || ".";
}

async function safeStat(filePath: string) {
  try {
    return await stat(filePath);
  } catch {
    return undefined;
  }
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function agentMatches(selected: AgentKind, candidate: Exclude<AgentKind, "all">): boolean {
  return selected === "all" || selected === candidate;
}

function isInsideOrEqual(parent: string, child: string): boolean {
  const relative = path.relative(parent, child);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function summarizeMatches(matches: InstructionMatch[]): TraceSummary {
  const byAgent = Object.fromEntries(AGENT_ORDER.map((agent) => [agent, 0])) as TraceSummary["byAgent"];
  for (const match of matches) {
    byAgent[match.agent] += 1;
  }
  return {
    total: matches.length,
    applies: matches.filter((match) => match.applies).length,
    skipped: matches.filter((match) => !match.applies).length,
    byAgent
  };
}

function formatAgentCounts(counts: TraceSummary["byAgent"]): string {
  return AGENT_ORDER.map((agent) => `${agent}=${counts[agent]}`).join(", ");
}

function slash(value: string): string {
  return value.split(path.sep).join("/");
}

function surfacePriority(match: InstructionMatch): number {
  if (match.surface === "AGENTS.md") return 0;
  if (match.surface === ".github/copilot-instructions.md") return 1;
  if (match.surface === ".github/instructions/*.instructions.md") return 2;
  return 3;
}
