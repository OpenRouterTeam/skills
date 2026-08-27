import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

const scriptsDir = fileURLToPath(new URL("..", import.meta.url));
const mockFetch = fileURLToPath(new URL("./mock-fetch.mjs", import.meta.url));

function runScript(script: string, args: string[]) {
  return spawnSync(
    process.execPath,
    ["--import", "tsx", "--import", mockFetch, script, ...args],
    {
      cwd: scriptsDir,
      encoding: "utf8",
      env: {
        ...process.env,
        OPENROUTER_API_KEY: "test-key",
      },
    }
  );
}

test("list-models refuses to rank output capacity as throughput or speed", () => {
  for (const sort of ["throughput", "speed"]) {
    const result = runScript("list-models.ts", ["--sort", sort]);

    assert.equal(result.status, 1);
    assert.match(result.stderr, /throughput is live, provider-specific performance data/i);
    assert.match(result.stderr, /get-endpoints\.ts/);
  }
});

test("list-models help advertises only capability sorts", () => {
  const result = runScript("list-models.ts", ["--help"]);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /--sort newest\|price\|context/);
  assert.doesNotMatch(
    result.stdout,
    /Usage: list-models\.ts[^\n]*(?:speed|throughput)/
  );
  assert.match(result.stdout, /get-endpoints\.ts/);
});

test("compare-models refuses to rank output capacity as throughput or speed", () => {
  for (const sort of ["throughput", "speed"]) {
    const result = runScript("compare-models.ts", [
      "example/large-output-slow",
      "example/small-output-fast",
      "--sort",
      sort,
    ]);

    assert.equal(result.status, 1);
    assert.match(result.stderr, /throughput is live, provider-specific performance data/i);
    assert.match(result.stderr, /get-endpoints\.ts/);
  }
});

test("compare-models help routes throughput comparisons to live endpoints", () => {
  const result = runScript("compare-models.ts", ["--help"]);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /--sort price\|context/);
  assert.doesNotMatch(
    result.stdout,
    /Usage: compare-models\.ts[^\n]*(?:speed|throughput)/
  );
  assert.match(result.stdout, /get-endpoints\.ts/);
});

test("the live endpoint fixture ranks generation speed independently of output capacity", () => {
  const largeOutput = runScript("get-endpoints.ts", [
    "example/large-output-slow",
    "--sort",
    "throughput",
  ]);
  const fastOutput = runScript("get-endpoints.ts", [
    "example/small-output-fast",
    "--sort",
    "throughput",
  ]);

  assert.equal(largeOutput.status, 0, largeOutput.stderr);
  assert.equal(fastOutput.status, 0, fastOutput.stderr);

  const largeOutputEndpoint = JSON.parse(largeOutput.stdout).endpoints[0];
  const fastOutputEndpoint = JSON.parse(fastOutput.stdout).endpoints[0];

  assert.ok(
    largeOutputEndpoint.max_completion_tokens > fastOutputEndpoint.max_completion_tokens
  );
  assert.ok(
    largeOutputEndpoint.throughput_30m_tokens_per_sec.p50 <
      fastOutputEndpoint.throughput_30m_tokens_per_sec.p50
  );
});

test("skill instructions route throughput questions to live endpoint data", () => {
  const skill = readFileSync(new URL("../../SKILL.md", import.meta.url), "utf8");
  const readme = readFileSync(new URL("../../README.md", import.meta.url), "utf8");

  assert.doesNotMatch(skill, /list-models\.ts --sort throughput/);
  assert.doesNotMatch(
    skill,
    /compare-models\.ts[^\n`]*--sort throughput/
  );
  assert.match(skill, /run `get-endpoints\.ts` once for each model/i);
  assert.match(readme, /sorting models by newest, price, or context/i);
});
