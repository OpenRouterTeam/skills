#!/usr/bin/env bun

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// CI eval runner for OpenRouterTeam/skills.
// Runs every authored eval suite under evals/ through waza (driven against
// OpenRouter — see .github/workflows/eval.yml for the COPILOT_PROVIDER_* env).
// Skips stub suites (description starts with "TODO: scaffolding only"), so CI
// only grades suites with real tasks. Exits non-zero if any suite fails.

const STUB_MARKER = "TODO: scaffolding only";
const REPO_ROOT = process.cwd();
const EVALS_DIR = join(REPO_ROOT, "evals");

function parseOutputDir(argv: string[]): string {
  const i = argv.indexOf("--output-dir");
  return i >= 0 && argv[i + 1] ? argv[i + 1] : "./results";
}

function isStub(specPath: string): boolean {
  const body = readFileSync(specPath, "utf-8");
  return body.includes(STUB_MARKER);
}

function discoverSuites(): { skill: string; spec: string }[] {
  const out: { skill: string; spec: string }[] = [];
  for (const entry of readdirSync(EVALS_DIR)) {
    if (entry.startsWith("_")) {
      continue;
    }
    const spec = join(EVALS_DIR, entry, "eval.yaml");
    if (!existsSync(spec)) {
      continue;
    }
    if (isStub(spec)) {
      console.error(`⏭  skip (stub): ${entry}`);
      continue;
    }
    out.push({ skill: entry, spec });
  }
  return out.sort((a, b) => a.skill.localeCompare(b.skill));
}

function main(): void {
  const outputDir = parseOutputDir(process.argv.slice(2));
  mkdirSync(outputDir, { recursive: true });

  const model = process.env.EVAL_MODEL ?? "anthropic/claude-opus-4.8";
  const suites = discoverSuites();
  if (suites.length === 0) {
    console.error("❌ no authored eval suites found under evals/");
    process.exit(1);
  }

  console.error(`▶ running ${suites.length} suite(s) on ${model}\n`);
  const results: { skill: string; code: number }[] = [];

  for (const { skill, spec } of suites) {
    console.error(`\n${"=".repeat(60)}\n▶ ${skill}\n${"=".repeat(60)}`);
    const run = spawnSync(
      "waza",
      [
        "run",
        spec,
        "--judge-model",
        model,
        "--output-dir",
        join(outputDir, skill),
        "--no-update-check",
        "-v",
      ],
      { cwd: REPO_ROOT, env: process.env, stdio: ["ignore", "inherit", "inherit"] },
    );
    results.push({ skill, code: run.status ?? 1 });
  }

  const failed = results.filter((r) => r.code !== 0);
  const summary = {
    model,
    total: results.length,
    passed: results.length - failed.length,
    failed: failed.length,
    suites: results,
  };
  writeFileSync(join(outputDir, "ci-summary.json"), JSON.stringify(summary, null, 2));

  console.error(`\n${"=".repeat(60)}\n CI EVAL SUMMARY\n${"=".repeat(60)}`);
  for (const r of results) {
    console.error(`  ${r.code === 0 ? "✓" : "✗"} ${r.skill}`);
  }
  console.error(`\n${summary.passed}/${summary.total} suites passed on ${model}`);

  process.exit(failed.length > 0 ? 1 : 0);
}

main();
