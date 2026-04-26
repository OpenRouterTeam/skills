import { readFileSync, existsSync } from 'fs';
import { app } from 'electron';
import { resolve } from 'path';

export interface DisplayConfig {
  theme: 'system' | 'paper' | 'ink';
  layout: 'sidebar' | 'single';
  messageStyle: 'ruled' | 'bubbles' | 'terminal';
  toolDisplay: 'collapsible' | 'inline' | 'hidden';
}

export interface FeatureFlags {
  autoTitle: boolean;
  modelPicker: boolean;
  warmTheme: boolean;
  workingLoader: boolean;
}

export interface AgentConfig {
  apiKey: string;
  model: string;
  systemPrompt: string;
  maxSteps: number;
  maxCost: number;
  dataDir: string;
  display: DisplayConfig;
  features: FeatureFlags;
}

const DEFAULTS: Omit<AgentConfig, 'dataDir'> = {
  apiKey: '',
  model: 'openrouter/auto',
  systemPrompt: [
    'You are a helpful desktop assistant with access to tools for reading, writing, editing, and searching files, and running shell commands.',
    '',
    'Guidelines:',
    '- Use your tools proactively to investigate before asking the user.',
    '- Keep working until the task is fully resolved.',
    '- Do not guess — verify with your tools.',
    '- Be concise and direct.',
  ].join('\n'),
  maxSteps: 20,
  maxCost: 1.0,
  display: {
    theme: 'system',
    layout: 'sidebar',
    messageStyle: 'ruled',
    toolDisplay: 'collapsible',
  },
  features: {
    autoTitle: true,
    modelPicker: true,
    warmTheme: true,
    workingLoader: true,
  },
};

export function loadConfig(overrides: Partial<AgentConfig> = {}): AgentConfig {
  let config: AgentConfig = { ...DEFAULTS, dataDir: app.getPath('userData') };

  const configPath = resolve(config.dataDir, 'agent.config.json');
  if (existsSync(configPath)) {
    try {
      const file = JSON.parse(readFileSync(configPath, 'utf-8'));
      if (file.display) config.display = { ...config.display, ...file.display };
      if (file.features) config.features = { ...config.features, ...file.features };
      config = { ...config, ...file, display: config.display, features: config.features };
    } catch {}
  }

  if (process.env.OPENROUTER_API_KEY) config.apiKey = process.env.OPENROUTER_API_KEY;

  if (overrides.display) config.display = { ...config.display, ...overrides.display };
  if (overrides.features) config.features = { ...config.features, ...overrides.features };
  config = { ...config, ...overrides, display: config.display, features: config.features };

  return config;
}
