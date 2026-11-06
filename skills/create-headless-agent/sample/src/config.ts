import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

function positiveNumber(name: string, raw: string): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`${name} must be a positive number, got: ${JSON.stringify(raw)}`);
  }
  return n;
}

export type OutputMode = 'text' | 'json' | 'quiet';

/**
 * 'always': shell, file_write and file_edit are denied unless listed in
 * approvedTools. 'never': run them without approval. Only use 'never' when
 * the agent never sees untrusted text (web results, repo files, stdin from
 * tickets, HTTP/MCP request bodies), because prompt injection in that text
 * can otherwise run arbitrary commands.
 */
export type ApprovalPolicy = 'always' | 'never';

const APPROVAL_POLICIES: readonly ApprovalPolicy[] = ['always', 'never'];

function approvalPolicy(name: string, raw: unknown): ApprovalPolicy {
  if (APPROVAL_POLICIES.includes(raw as ApprovalPolicy)) return raw as ApprovalPolicy;
  throw new Error(`${name} must be one of ${APPROVAL_POLICIES.join(', ')}, got: ${JSON.stringify(raw)}`);
}

export interface AgentConfig {
  apiKey: string;
  model: string;
  name: string;
  systemPrompt: string;
  maxSteps: number;
  maxCost: number;
  sessionDir: string;
  sessionEnabled: boolean;
  outputMode: OutputMode;
  approvalPolicy: ApprovalPolicy;
  approvedTools: string[];
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
  sessionEnabled: true,
  outputMode: 'text',
  approvalPolicy: 'always',
  approvedTools: [],
};

export function loadConfig(overrides: Partial<AgentConfig> = {}, opts?: { skipApiKey?: boolean }): AgentConfig {
  let config = { ...DEFAULTS };

  const configPath = resolve('agent.config.json');
  if (existsSync(configPath)) {
    // agent.config.json is read from the cwd, which may be a cloned repo the
    // agent is working on, so it must not be able to turn off tool approval.
    const { approvalPolicy: _p, approvedTools: _t, ...file } = JSON.parse(readFileSync(configPath, 'utf-8'));
    config = { ...config, ...file };
  }

  if (process.env.OPENROUTER_API_KEY) config.apiKey = process.env.OPENROUTER_API_KEY;
  if (process.env.AGENT_MODEL) config.model = process.env.AGENT_MODEL;
  if (process.env.AGENT_MAX_STEPS) config.maxSteps = positiveNumber('AGENT_MAX_STEPS', process.env.AGENT_MAX_STEPS);
  if (process.env.AGENT_MAX_COST) config.maxCost = positiveNumber('AGENT_MAX_COST', process.env.AGENT_MAX_COST);

  if (process.env.AGENT_APPROVAL_POLICY) config.approvalPolicy = approvalPolicy('AGENT_APPROVAL_POLICY', process.env.AGENT_APPROVAL_POLICY);
  if (process.env.AGENT_APPROVED_TOOLS !== undefined) {
    config.approvedTools = process.env.AGENT_APPROVED_TOOLS.split(',').map((t) => t.trim()).filter(Boolean);
  }

  config = { ...config, ...overrides };
  config.approvalPolicy = approvalPolicy('approvalPolicy', config.approvalPolicy);
  if (!Array.isArray(config.approvedTools) || !config.approvedTools.every((t) => typeof t === 'string')) {
    throw new Error('approvedTools must be an array of tool names');
  }
  if (!config.apiKey && !opts?.skipApiKey) throw new Error('OPENROUTER_API_KEY is required.');
  return config;
}
