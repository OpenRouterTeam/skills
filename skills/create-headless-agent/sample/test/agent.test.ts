import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { loadConfig } from '../src/config.js';

describe('loadConfig', () => {
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    // Save and clear relevant env vars
    for (const key of ['OPENROUTER_API_KEY', 'AGENT_MODEL', 'AGENT_MAX_STEPS', 'AGENT_MAX_COST']) {
      savedEnv[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
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
});
