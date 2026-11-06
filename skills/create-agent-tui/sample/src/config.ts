import { readFileSync, existsSync } from 'fs';
import { homedir } from 'os';
import { join, resolve } from 'path';

const APP_NAME = 'my-agent';

function positiveNumber(name: string, raw: string | number): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`${name} must be a positive number, got: ${JSON.stringify(raw)}`);
  }
  return n;
}

export interface LoaderConfig {
  text: string;
  style: 'gradient' | 'spinner' | 'minimal';
}

export interface DisplayConfig {
  toolDisplay: 'emoji' | 'grouped' | 'minimal' | 'hidden';
  reasoning: boolean;
  inputStyle: 'block' | 'bordered' | 'plain';
  loader: LoaderConfig;
}

export interface AgentConfig {
  apiKey: string;
  model: string;
  name: string;
  systemPrompt: string;
  maxSteps: number;
  maxCost: number;
  sessionDir: string;
  showBanner: boolean;
  display: DisplayConfig;
  slashCommands: boolean;
}

const DEFAULTS: AgentConfig = {
  apiKey: '',
  model: 'anthropic/claude-haiku-4.5',
  name: 'My Agent',
  systemPrompt: [
    'You are a coding assistant with access to tools for reading, writing, editing, and searching files, and running shell commands.',
    '',
    'Current working directory: {cwd}',
    '',
    'Guidelines:',
    '- Use your tools proactively. Explore the codebase to find answers instead of asking the user.',
    '- Keep working until the task is fully resolved before responding.',
    '- Do not guess or make up information — use your tools to verify.',
    '- Be concise and direct.',
    '- Show file paths clearly when working with files.',
    '- Prefer grep and glob tools over shell commands for file search.',
    '- When editing code, make minimal targeted changes consistent with the existing style.',
  ].join('\n'),
  maxSteps: 20,
  maxCost: 1.0,
  sessionDir: '.sessions',
  showBanner: true,
  display: {
    toolDisplay: 'grouped',
    reasoning: false,
    inputStyle: 'block',
    loader: { text: 'Working', style: 'spinner' },
  },
  slashCommands: true,
};

type FieldType = 'string' | 'number' | 'boolean' | readonly string[];

// Fields a config file may set, and their types. apiKey is env-only so it never sits in a file.
const FILE_FIELDS: Record<string, FieldType> = {
  model: 'string',
  name: 'string',
  systemPrompt: 'string',
  maxSteps: 'number',
  maxCost: 'number',
  sessionDir: 'string',
  showBanner: 'boolean',
  slashCommands: 'boolean',
};
const DISPLAY_FIELDS: Record<string, FieldType> = {
  toolDisplay: ['emoji', 'grouped', 'minimal', 'hidden'],
  reasoning: 'boolean',
  inputStyle: ['block', 'bordered', 'plain'],
};
const LOADER_FIELDS: Record<string, FieldType> = {
  text: 'string',
  style: ['gradient', 'spinner', 'minimal'],
};

/**
 * The config file is read from an explicit path (--config or AGENT_CONFIG) or the user's
 * config directory, never from the working directory: a cloned repo could otherwise ship
 * an agent.config.json that replaces the system prompt and lifts the cost and step limits.
 */
export function resolveConfigPath(explicit?: string): { path: string; required: boolean } {
  const chosen = explicit || process.env.AGENT_CONFIG;
  if (chosen) return { path: resolve(chosen), required: true };
  const base = process.env.XDG_CONFIG_HOME || join(homedir(), '.config');
  return { path: join(base, APP_NAME, 'agent.config.json'), required: false };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function pick(where: string, raw: unknown, fields: Record<string, FieldType>): Record<string, unknown> {
  if (!isObject(raw)) throw new Error(`${where} must be a JSON object`);
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    const type = fields[key];
    if (!type) throw new Error(`${where}: unsupported field "${key}"`);
    if (Array.isArray(type)) {
      if (!type.includes(value as string)) throw new Error(`${where}: "${key}" must be one of ${type.join(', ')}`);
    } else if (typeof value !== type) {
      throw new Error(`${where}: "${key}" must be a ${type}`);
    }
    out[key] = type === 'number' ? positiveNumber(`${where}: ${key}`, value as number) : value;
  }
  return out;
}

function readConfigFile(path: string, required: boolean): Record<string, any> {
  if (!existsSync(path)) {
    if (required) throw new Error(`Config file not found: ${path}`);
    return {};
  }
  const raw: unknown = JSON.parse(readFileSync(path, 'utf-8'));
  if (!isObject(raw)) throw new Error(`${path} must contain a JSON object`);
  const { display, ...rest } = raw;
  const out: Record<string, any> = pick(path, rest, FILE_FIELDS);
  if (display !== undefined) {
    if (!isObject(display)) throw new Error(`${path}: "display" must be a JSON object`);
    const { loader, ...displayRest } = display;
    out.display = pick(`${path}: display`, displayRest, DISPLAY_FIELDS);
    if (loader !== undefined) out.display.loader = pick(`${path}: display.loader`, loader, LOADER_FIELDS);
  }
  return out;
}

export function loadConfig(
  overrides: Partial<AgentConfig> = {},
  opts?: { skipApiKey?: boolean; configPath?: string },
): AgentConfig {
  let config = { ...DEFAULTS };

  const { path, required } = resolveConfigPath(opts?.configPath);
  const file = readConfigFile(path, required);
  if (file.display) {
    config.display = {
      ...config.display,
      ...file.display,
      loader: { ...config.display.loader, ...file.display.loader },
    };
  }
  config = { ...config, ...file, display: config.display };

  if (process.env.OPENROUTER_API_KEY) config.apiKey = process.env.OPENROUTER_API_KEY;
  if (process.env.AGENT_MODEL) config.model = process.env.AGENT_MODEL;
  if (process.env.AGENT_MAX_STEPS) config.maxSteps = positiveNumber('AGENT_MAX_STEPS', process.env.AGENT_MAX_STEPS);
  if (process.env.AGENT_MAX_COST) config.maxCost = positiveNumber('AGENT_MAX_COST', process.env.AGENT_MAX_COST);
  if (overrides.display) {
    config.display = { ...config.display, ...overrides.display };
  }
  config = { ...config, ...overrides, display: config.display };
  if (!config.apiKey && !opts?.skipApiKey) throw new Error('OPENROUTER_API_KEY is required.');
  return config;
}
