#!/usr/bin/env bun

import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// waza `program` grader: verifies that the code the agent produced actually
// parses / type-checks, not just that it looks right to a judge (gap #4 from
// the OpenAI eval methodology — "does the artifact run").
//
// waza pipes the agent's full response to this grader on STDIN. We extract
// fenced code blocks, write JS/TS to temp files, and syntax/type-check them.
// Exit 0 = all blocks valid (pass); exit 1 = a block failed to parse (fail).
//
// Usage in a task:
//   - type: program
//     name: produced_code_parses
//     config:
//       command: "bun"
//       args: ["evals/_graders/verify-code-runs.ts"]
//       timeout: 60

interface Block {
  lang: string;
  code: string;
}

function extractBlocks(md: string): Block[] {
  const blocks: Block[] = [];
  const fence = /```([a-zA-Z0-9_+-]*)\n([\s\S]*?)```/g;
  let m: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: standard regex exec loop
  while ((m = fence.exec(md)) !== null) {
    blocks.push({ lang: (m[1] || "").toLowerCase(), code: m[2] });
  }
  return blocks;
}

const JS_LANGS = new Set(["js", "javascript", "jsx", "mjs", "cjs", "node"]);
const TS_LANGS = new Set(["ts", "typescript", "tsx"]);

function checkJs(file: string): { ok: boolean; err: string } {
  const r = spawnSync("node", ["--check", file], { encoding: "utf-8" });
  return { ok: r.status === 0, err: r.stderr || "" };
}

function checkTs(file: string): { ok: boolean; err: string } {
  // Type-check without emitting; skip lib checks for speed and to tolerate
  // missing ambient deps in snippet-sized code.
  const r = spawnSync(
    "npx",
    ["--yes", "tsc", "--noEmit", "--skipLibCheck", "--allowJs", "--moduleResolution", "node", file],
    { encoding: "utf-8", timeout: 50_000 },
  );
  // tsc errors about missing imports are common in snippets and not what we're
  // testing; we only fail on genuine syntax errors (TS1xxx).
  const syntaxError = /error TS1\d{3}/.test(r.stdout || "");
  return { ok: !syntaxError, err: syntaxError ? r.stdout : "" };
}

async function main(): Promise<void> {
  const input = await Bun.stdin.text();
  const blocks = extractBlocks(input);
  const codeBlocks = blocks.filter((b) => JS_LANGS.has(b.lang) || TS_LANGS.has(b.lang));

  if (codeBlocks.length === 0) {
    process.stderr.write("verify-code-runs: no JS/TS code blocks found in agent output\n");
    process.exit(1);
  }

  const dir = mkdtempSync(join(tmpdir(), "verify-code-"));
  let failures = 0;
  for (const [i, b] of codeBlocks.entries()) {
    const isTs = TS_LANGS.has(b.lang);
    const file = join(dir, `block-${i}.${isTs ? "ts" : "js"}`);
    writeFileSync(file, b.code);
    const res = isTs ? checkTs(file) : checkJs(file);
    if (!res.ok) {
      failures++;
      process.stderr.write(`verify-code-runs: block ${i} (${b.lang}) FAILED:\n${res.err.slice(0, 500)}\n`);
    }
  }

  if (failures > 0) {
    process.stderr.write(`verify-code-runs: ${failures}/${codeBlocks.length} block(s) failed to parse\n`);
    process.exit(1);
  }
  process.stderr.write(`verify-code-runs: all ${codeBlocks.length} code block(s) parse cleanly\n`);
  process.exit(0);
}

main();
