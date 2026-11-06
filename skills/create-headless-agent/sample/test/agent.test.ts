import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { loadConfig } from '../src/config.js';

describe('loadConfig', () => {
  const savedEnv: Record<string, string | undefined> = {};
  const savedCwd = process.cwd();
  let tmp: string;

  beforeEach(() => {
    // Save and clear relevant env vars
    for (const key of ['OPENROUTER_API_KEY', 'AGENT_MODEL', 'AGENT_MAX_STEPS', 'AGENT_MAX_COST', 'AGENT_CONFIG', 'XDG_CONFIG_HOME']) {
      savedEnv[key] = process.env[key];
      delete process.env[key];
    }
    tmp = mkdtempSync(join(tmpdir(), 'agent-config-'));
    process.env.XDG_CONFIG_HOME = join(tmp, 'xdg');
  });

  afterEach(() => {
    process.chdir(savedCwd);
    rmSync(tmp, { recursive: true, force: true });
    // Restore env vars
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  test('defaults are correct', () => {
    const config = loadConfig({}, { skipApiKey: true });

    expect(config.model).toBe('anthropic/claude-haiku-4.5');
    expect(config.maxSteps).toBe(20);
    expect(config.maxCost).toBe(1.0);
    expect(config.sessionEnabled).toBe(true);
    expect(config.outputMode).toBe('text');
    expect(config.name).toBe('My Agent');
    expect(config.sessionDir).toBe('.sessions');
    expect(config.systemPrompt).toContain('coding assistant');
  });

  test('env vars override defaults', () => {
    process.env.OPENROUTER_API_KEY = 'test-key-123';
    process.env.AGENT_MODEL = 'openai/gpt-4o';
    process.env.AGENT_MAX_STEPS = '50';
    process.env.AGENT_MAX_COST = '5.0';

    const config = loadConfig({});

    expect(config.apiKey).toBe('test-key-123');
    expect(config.model).toBe('openai/gpt-4o');
    expect(config.maxSteps).toBe(50);
    expect(config.maxCost).toBe(5.0);
  });

  test('overrides take precedence over env vars', () => {
    process.env.OPENROUTER_API_KEY = 'env-key';
    process.env.AGENT_MODEL = 'openai/gpt-4o';

    const config = loadConfig({ model: 'google/gemini-2.0-flash-001', outputMode: 'json' });

    expect(config.model).toBe('google/gemini-2.0-flash-001');
    expect(config.outputMode).toBe('json');
    expect(config.apiKey).toBe('env-key');
  });

  test('skipApiKey option prevents error when no key set', () => {
    expect(() => loadConfig({}, { skipApiKey: true })).not.toThrow();
  });

  test('throws when apiKey missing and skipApiKey not set', () => {
    expect(() => loadConfig({})).toThrow('OPENROUTER_API_KEY is required');
  });

  test('ignores agent.config.json in the working directory', () => {
    const project = join(tmp, 'project');
    mkdirSync(project);
    writeFileSync(join(project, 'agent.config.json'), JSON.stringify({ systemPrompt: 'MARKER', maxCost: 999, maxSteps: 999 }));
    process.chdir(project);

    const config = loadConfig({}, { skipApiKey: true });

    expect(config.systemPrompt).not.toContain('MARKER');
    expect(config.maxCost).toBe(1.0);
    expect(config.maxSteps).toBe(20);
  });

  test('reads the user config directory', () => {
    mkdirSync(join(tmp, 'xdg', 'my-agent'), { recursive: true });
    writeFileSync(join(tmp, 'xdg', 'my-agent', 'agent.config.json'), JSON.stringify({ model: 'openai/gpt-4o', maxCost: 2 }));

    const config = loadConfig({}, { skipApiKey: true });

    expect(config.model).toBe('openai/gpt-4o');
    expect(config.maxCost).toBe(2);
  });

  test('reads an explicit config path', () => {
    const file = join(tmp, 'custom.json');
    writeFileSync(file, JSON.stringify({ systemPrompt: 'custom prompt' }));

    expect(loadConfig({}, { skipApiKey: true, configPath: file }).systemPrompt).toBe('custom prompt');
    expect(() => loadConfig({}, { skipApiKey: true, configPath: join(tmp, 'missing.json') })).toThrow('Config file not found');
  });

  test('rejects unknown fields, apiKey, and invalid limits in the config file', () => {
    const file = join(tmp, 'bad.json');
    for (const [body, error] of [
      [{ apiKey: 'sk-test' }, 'unsupported field "apiKey"'],
      [{ maxCost: -1 }, 'must be a positive number'],
      [{ maxSteps: 'many' }, '"maxSteps" must be a number'],
    ] as const) {
      writeFileSync(file, JSON.stringify(body));
      expect(() => loadConfig({}, { skipApiKey: true, configPath: file })).toThrow(error);
    }
  });
});
