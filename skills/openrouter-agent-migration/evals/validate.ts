#!/usr/bin/env bun
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

interface Check {
  name: string;
  passed: boolean;
  detail: string;
}

interface RunResult {
  exit_code: number;
  stdout: string;
  stderr: string;
}

interface ValidateOutput {
  fixture: string;
  project: string;
  passed: boolean;
  checks: Check[];
  run_results?: {
    typecheck: RunResult;
    tests: RunResult;
  };
  summary: { total: number; passed: number; failed: number };
}

const args = process.argv.slice(2);
const flags: Record<string, string | boolean> = {};
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--skip-run') {
    flags['skip-run'] = true;
    continue;
  }
  if (arg.startsWith('--')) {
    const key = arg.slice(2);
    const next = args[i + 1];
    if (next !== undefined && !next.startsWith('--')) {
      flags[key] = next;
      i++;
    } else {
      flags[key] = true;
    }
  }
}

const fixture = flags['fixture'] as string | undefined;
const rawProject = flags['project'] as string | undefined;
const skipRun = !!flags['skip-run'];

if (!fixture || !rawProject) {
  process.stderr.write(
    'Usage: bun evals/validate.ts --fixture <name> --project <path> [--skip-run]\n',
  );
  process.exit(1);
}

const projectPath = resolve(rawProject);

function check(name: string, condition: boolean, detail: string): Check {
  return { name, passed: condition, detail };
}

function readPkg(dir: string): Record<string, Record<string, string>> {
  const pkgPath = join(dir, 'package.json');
  if (!existsSync(pkgPath)) return {};
  return JSON.parse(readFileSync(pkgPath, 'utf-8')) as Record<
    string,
    Record<string, string>
  >;
}

function collectSrcFiles(dir: string): Map<string, string> {
  const srcDir = join(dir, 'src');
  const files = new Map<string, string>();
  if (!existsSync(srcDir)) return files;
  for (const entry of readdirSync(srcDir)) {
    if (!entry.endsWith('.ts')) continue;
    files.set(entry, readFileSync(join(srcDir, entry), 'utf-8'));
  }
  return files;
}

function hasImportFrom(content: string, from: string): boolean {
  const escaped = from.replace(/[/\\@]/g, (c) => `\\${c}`);
  return new RegExp(`from\\s+['"]${escaped}['"]`).test(content);
}

function hasNamedImport(content: string, name: string, from: string): boolean {
  const escapedFrom = from.replace(/[/\\@]/g, (c) => `\\${c}`);
  return new RegExp(
    `import[^;'"]*\\b${name}\\b[^;'"]*from\\s+['"]${escapedFrom}['"]`,
  ).test(content);
}

function anyFileHasImportFrom(files: Map<string, string>, from: string): boolean {
  for (const content of files.values()) {
    if (hasImportFrom(content, from)) return true;
  }
  return false;
}

async function runCmd(cmd: string[], cwd: string): Promise<RunResult> {
  const proc = Bun.spawn(cmd, { cwd, stdout: 'pipe', stderr: 'pipe' });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { exit_code: exitCode, stdout, stderr };
}

function checksForAgentOnly(
  pkg: Record<string, Record<string, string>>,
  files: Map<string, string>,
): Check[] {
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  const agentTs = files.get('agent.ts') ?? '';
  const toolsTs = files.get('tools.ts') ?? '';
  const typesTs = files.get('types.ts') ?? '';

  return [
    check(
      '@openrouter/sdk removed from dependencies',
      !deps['@openrouter/sdk'],
      deps['@openrouter/sdk']
        ? `Found @openrouter/sdk@${deps['@openrouter/sdk']}`
        : 'Not present',
    ),
    check(
      '@openrouter/agent added to dependencies',
      !!deps['@openrouter/agent'],
      deps['@openrouter/agent']
        ? `Found @openrouter/agent@${deps['@openrouter/agent']}`
        : 'Not found in dependencies',
    ),
    check(
      'No stale @openrouter/sdk imports in any src file',
      !anyFileHasImportFrom(files, '@openrouter/sdk'),
      anyFileHasImportFrom(files, '@openrouter/sdk')
        ? 'Found @openrouter/sdk import in src/'
        : 'Clean — no @openrouter/sdk imports',
    ),
    check(
      "src/agent.ts imports OpenRouter from '@openrouter/agent' (named)",
      hasNamedImport(agentTs, 'OpenRouter', '@openrouter/agent'),
      agentTs ? 'Check for named import { OpenRouter }' : 'agent.ts not found',
    ),
    check(
      "src/agent.ts imports stepCountIs from '@openrouter/agent/stop-conditions'",
      hasNamedImport(agentTs, 'stepCountIs', '@openrouter/agent/stop-conditions'),
      'Expects stop condition from @openrouter/agent/stop-conditions subpath',
    ),
    check(
      "src/agent.ts imports hasToolCall from '@openrouter/agent/stop-conditions'",
      hasNamedImport(agentTs, 'hasToolCall', '@openrouter/agent/stop-conditions'),
      'Expects hasToolCall from @openrouter/agent/stop-conditions subpath',
    ),
    check(
      "src/agent.ts imports maxCost from '@openrouter/agent/stop-conditions'",
      hasNamedImport(agentTs, 'maxCost', '@openrouter/agent/stop-conditions'),
      'Expects maxCost from @openrouter/agent/stop-conditions subpath',
    ),
    check(
      "src/tools.ts imports tool from '@openrouter/agent/tool'",
      hasNamedImport(toolsTs, 'tool', '@openrouter/agent/tool'),
      'Expects tool factory from @openrouter/agent/tool',
    ),
    check(
      "src/tools.ts imports Tool type from '@openrouter/agent/tool-types'",
      hasNamedImport(toolsTs, 'Tool', '@openrouter/agent/tool-types'),
      'Expects Tool type from @openrouter/agent/tool-types',
    ),
    check(
      "src/types.ts imports CallModelInput from '@openrouter/agent/async-params'",
      hasNamedImport(typesTs, 'CallModelInput', '@openrouter/agent/async-params'),
      'Expects CallModelInput from @openrouter/agent/async-params',
    ),
    check(
      "src/types.ts imports ModelResult from '@openrouter/agent/model-result'",
      hasImportFrom(typesTs, '@openrouter/agent/model-result'),
      'Expects ModelResult from @openrouter/agent/model-result',
    ),
    check(
      "src/types.ts imports ToolWithGenerator from '@openrouter/agent/tool-types'",
      hasNamedImport(typesTs, 'ToolWithGenerator', '@openrouter/agent/tool-types'),
      'Expects ToolWithGenerator from @openrouter/agent/tool-types',
    ),
  ];
}

function checksForMixedPlatformAgent(
  pkg: Record<string, Record<string, string>>,
  files: Map<string, string>,
): Check[] {
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  const platformTs = files.get('platform.ts') ?? '';
  const agentTs = files.get('agent.ts') ?? '';

  return [
    check(
      '@openrouter/sdk retained in dependencies',
      !!deps['@openrouter/sdk'],
      deps['@openrouter/sdk']
        ? `Found @openrouter/sdk@${deps['@openrouter/sdk']}`
        : 'Missing — platform features require @openrouter/sdk',
    ),
    check(
      '@openrouter/agent added to dependencies',
      !!deps['@openrouter/agent'],
      deps['@openrouter/agent']
        ? `Found @openrouter/agent@${deps['@openrouter/agent']}`
        : 'Not found in dependencies',
    ),
    check(
      "src/platform.ts retains import from '@openrouter/sdk'",
      hasImportFrom(platformTs, '@openrouter/sdk'),
      platformTs
        ? 'platform.ts must keep @openrouter/sdk for models/credits/chat'
        : 'platform.ts not found',
    ),
    check(
      "src/agent.ts no longer imports from '@openrouter/sdk'",
      !hasImportFrom(agentTs, '@openrouter/sdk'),
      hasImportFrom(agentTs, '@openrouter/sdk')
        ? 'Still contains @openrouter/sdk import'
        : 'Clean',
    ),
    check(
      "src/agent.ts imports OpenRouter from '@openrouter/agent'",
      hasNamedImport(agentTs, 'OpenRouter', '@openrouter/agent'),
      'Expects OpenRouter (possibly aliased as Agent) from @openrouter/agent',
    ),
    check(
      "src/agent.ts imports tool from '@openrouter/agent/tool'",
      hasNamedImport(agentTs, 'tool', '@openrouter/agent/tool'),
      'Expects tool factory from @openrouter/agent/tool',
    ),
    check(
      "src/agent.ts imports stepCountIs from '@openrouter/agent/stop-conditions'",
      hasNamedImport(agentTs, 'stepCountIs', '@openrouter/agent/stop-conditions'),
      'Expects stepCountIs from @openrouter/agent/stop-conditions',
    ),
    check(
      "src/agent.ts imports maxTokensUsed from '@openrouter/agent/stop-conditions'",
      hasNamedImport(agentTs, 'maxTokensUsed', '@openrouter/agent/stop-conditions'),
      'Expects maxTokensUsed from @openrouter/agent/stop-conditions',
    ),
    check(
      "src/agent.ts imports finishReasonIs from '@openrouter/agent/stop-conditions'",
      hasNamedImport(agentTs, 'finishReasonIs', '@openrouter/agent/stop-conditions'),
      'Expects finishReasonIs from @openrouter/agent/stop-conditions',
    ),
  ];
}

function checksForStreamingConverters(
  pkg: Record<string, Record<string, string>>,
  files: Map<string, string>,
): Check[] {
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  const convertersTs = files.get('converters.ts') ?? '';
  const streamTs = files.get('stream.ts') ?? '';
  const typeGuardsTs = files.get('type-guards.ts') ?? '';

  return [
    check(
      '@openrouter/sdk removed from dependencies',
      !deps['@openrouter/sdk'],
      deps['@openrouter/sdk']
        ? `Found @openrouter/sdk@${deps['@openrouter/sdk']}`
        : 'Not present',
    ),
    check(
      '@openrouter/agent added to dependencies',
      !!deps['@openrouter/agent'],
      deps['@openrouter/agent']
        ? `Found @openrouter/agent@${deps['@openrouter/agent']}`
        : 'Not found in dependencies',
    ),
    check(
      'No stale @openrouter/sdk imports in any src file',
      !anyFileHasImportFrom(files, '@openrouter/sdk'),
      anyFileHasImportFrom(files, '@openrouter/sdk')
        ? 'Found @openrouter/sdk import in src/'
        : 'Clean — no @openrouter/sdk imports',
    ),
    check(
      "src/converters.ts imports fromClaudeMessages from '@openrouter/agent'",
      hasNamedImport(convertersTs, 'fromClaudeMessages', '@openrouter/agent'),
      'Expects fromClaudeMessages from @openrouter/agent barrel',
    ),
    check(
      "src/converters.ts imports toClaudeMessage from '@openrouter/agent'",
      hasNamedImport(convertersTs, 'toClaudeMessage', '@openrouter/agent'),
      'Expects toClaudeMessage from @openrouter/agent barrel',
    ),
    check(
      "src/converters.ts imports fromChatMessages from '@openrouter/agent'",
      hasNamedImport(convertersTs, 'fromChatMessages', '@openrouter/agent'),
      'Expects fromChatMessages from @openrouter/agent barrel',
    ),
    check(
      "src/converters.ts imports toChatMessage from '@openrouter/agent'",
      hasNamedImport(convertersTs, 'toChatMessage', '@openrouter/agent'),
      'Expects toChatMessage from @openrouter/agent barrel',
    ),
    check(
      "src/type-guards.ts imports hasExecuteFunction from '@openrouter/agent/tool-types'",
      hasNamedImport(typeGuardsTs, 'hasExecuteFunction', '@openrouter/agent/tool-types'),
      'Expects hasExecuteFunction from @openrouter/agent/tool-types',
    ),
    check(
      "src/type-guards.ts imports isGeneratorTool from '@openrouter/agent/tool-types'",
      hasNamedImport(typeGuardsTs, 'isGeneratorTool', '@openrouter/agent/tool-types'),
      'Expects isGeneratorTool from @openrouter/agent/tool-types',
    ),
    check(
      "src/type-guards.ts imports isRegularExecuteTool from '@openrouter/agent/tool-types'",
      hasNamedImport(typeGuardsTs, 'isRegularExecuteTool', '@openrouter/agent/tool-types'),
      'Expects isRegularExecuteTool from @openrouter/agent/tool-types',
    ),
    check(
      "src/type-guards.ts imports tool from '@openrouter/agent/tool'",
      hasNamedImport(typeGuardsTs, 'tool', '@openrouter/agent/tool'),
      'Expects tool factory from @openrouter/agent/tool',
    ),
    check(
      "src/stream.ts imports CallModelInput from '@openrouter/agent/async-params'",
      hasNamedImport(streamTs, 'CallModelInput', '@openrouter/agent/async-params'),
      'Expects CallModelInput from @openrouter/agent/async-params',
    ),
  ];
}

const pkg = readPkg(projectPath);
const files = collectSrcFiles(projectPath);

let fixtureChecks: Check[];
if (fixture === 'agent-only') {
  fixtureChecks = checksForAgentOnly(pkg, files);
} else if (fixture === 'mixed-platform-agent') {
  fixtureChecks = checksForMixedPlatformAgent(pkg, files);
} else if (fixture === 'streaming-converters') {
  fixtureChecks = checksForStreamingConverters(pkg, files);
} else {
  process.stderr.write(
    `Unknown fixture: ${fixture}. Valid values: agent-only, mixed-platform-agent, streaming-converters\n`,
  );
  process.exit(1);
}

let runResults: ValidateOutput['run_results'] | undefined;
if (!skipRun) {
  const [typecheck, tests] = await Promise.all([
    runCmd(['bun', 'run', 'build'], projectPath),
    runCmd(['bun', 'test'], projectPath),
  ]);

  fixtureChecks.push(
    check(
      'TypeScript type check passes (tsc --noEmit)',
      typecheck.exit_code === 0,
      typecheck.exit_code === 0
        ? 'Exited 0'
        : `Exit ${typecheck.exit_code}: ${typecheck.stderr.slice(0, 400)}`,
    ),
    check(
      'Test suite passes (bun test)',
      tests.exit_code === 0,
      tests.exit_code === 0
        ? 'Exited 0'
        : `Exit ${tests.exit_code}: ${tests.stderr.slice(0, 400)}`,
    ),
  );

  runResults = { typecheck, tests };
}

const passedCount = fixtureChecks.filter((c) => c.passed).length;
const output: ValidateOutput = {
  fixture,
  project: projectPath,
  passed: fixtureChecks.every((c) => c.passed),
  checks: fixtureChecks,
  run_results: runResults,
  summary: {
    total: fixtureChecks.length,
    passed: passedCount,
    failed: fixtureChecks.length - passedCount,
  },
};

process.stdout.write(JSON.stringify(output, null, 2) + '\n');
process.exit(output.passed ? 0 : 1);
