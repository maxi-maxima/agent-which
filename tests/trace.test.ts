import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { renderMarkdown, traceInstructions } from "../src/index.js";

async function makeWorkspace(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "agent-which-"));
  await writeFile(path.join(root, "AGENTS.md"), "# Root agent instructions\n");
  await mkdir(path.join(root, "src", "feature"), { recursive: true });
  await writeFile(path.join(root, "src", "AGENTS.md"), "# Src instructions\n");
  await writeFile(path.join(root, "src", "feature", "widget.ts"), "export const widget = 1;\n");
  await mkdir(path.join(root, ".github", "instructions"), { recursive: true });
  await writeFile(
    path.join(root, ".github", "instructions", "typescript.instructions.md"),
    "---\napplyTo: \"src/**/*.ts\"\n---\n# TypeScript instructions\n"
  );
  await writeFile(path.join(root, "CLAUDE.md"), "# Claude only\n");
  await writeFile(path.join(root, "ANTHROPIC.md"), "# Anthropic only\n");
  return root;
}

describe("traceInstructions", () => {
  test("traces nested AGENTS.md files that apply to a target path", async () => {
    const root = await makeWorkspace();

    const result = await traceInstructions({
      root,
      target: "src/feature/widget.ts",
      agent: "codex"
    });

    expect(result.matches.map((match) => path.relative(root, match.path))).toEqual([
      "AGENTS.md",
      path.join("src", "AGENTS.md")
    ]);
    expect(result.matches.every((match) => match.applies)).toBe(true);
    expect(result.summary).toEqual({
      total: 2,
      applies: 2,
      skipped: 0,
      byAgent: { codex: 2, copilot: 0, cursor: 0, claude: 0, anthropic: 0, gemini: 0 }
    });
  });

  test("traces Copilot repository and path-scoped instruction files", async () => {
    const root = await makeWorkspace();

    const result = await traceInstructions({
      root,
      target: "src/feature/widget.ts",
      agent: "copilot"
    });

    expect(result.matches.map((match) => path.relative(root, match.path))).toEqual([
      "AGENTS.md",
      path.join("src", "AGENTS.md"),
      path.join(".github", "instructions", "typescript.instructions.md")
    ]);
    expect(result.matches.at(-1)?.reason).toContain("applyTo");
  });

  test("marks nearby instructions that do not apply to the selected agent", async () => {
    const root = await makeWorkspace();

    const result = await traceInstructions({
      root,
      target: "src/feature/widget.ts",
      agent: "all"
    });

    expect(result.matches.some((match) => match.surface === "CLAUDE.md" && match.agent === "claude")).toBe(true);
    expect(result.matches.some((match) => match.surface === "ANTHROPIC.md" && match.agent === "anthropic")).toBe(true);
  });

  test("keeps non-matching Copilot applyTo files visible in all-agent traces", async () => {
    const root = await makeWorkspace();
    await writeFile(
      path.join(root, ".github", "instructions", "docs.instructions.md"),
      "---\napplyTo: \"docs/**/*.md\"\n---\n# Docs instructions\n"
    );

    const result = await traceInstructions({
      root,
      target: "src/feature/widget.ts",
      agent: "all"
    });

    const skipped = result.matches.find((match) => match.path.endsWith("docs.instructions.md"));
    expect(skipped?.applies).toBe(false);
    expect(skipped?.reason).toContain("does not match");
  });

  test("renders a Markdown report table", async () => {
    const root = await makeWorkspace();
    const result = await traceInstructions({
      root,
      target: "src/feature/widget.ts",
      agent: "codex"
    });

    expect(renderMarkdown(result)).toContain("| Target | `src/feature/widget.ts` |");
    expect(renderMarkdown(result)).toContain("| Applies | 2 |");
    expect(renderMarkdown(result)).toContain("| By agent | codex=2, copilot=0, cursor=0, claude=0, anthropic=0, gemini=0 |");
    expect(renderMarkdown(result)).toContain("| 1 | `AGENTS.md` | codex | AGENTS.md | applies |");
  });
});
