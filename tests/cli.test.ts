import { describe, expect, test } from "vitest";
import { parseArgs } from "../src/cli.js";

describe("parseArgs", () => {
  test("parses trace options", () => {
    expect(parseArgs(["trace", "src/index.ts", "--root", "fixtures", "--agent", "codex", "--json"])).toEqual({
      command: "trace",
      root: "fixtures",
      target: "src/index.ts",
      agent: "codex",
      json: true,
      out: undefined
    });
  });

  test("rejects missing option values before consuming the next option", () => {
    expect(() => parseArgs(["trace", "src/index.ts", "--root", "--json"])).toThrow("--root requires a value");
    expect(() => parseArgs(["trace", "src/index.ts", "--agent", "-h"])).toThrow("--agent requires a value");
  });

  test("rejects unknown options", () => {
    expect(() => parseArgs(["trace", "src/index.ts", "--format", "json"])).toThrow("Unknown option --format");
  });
});