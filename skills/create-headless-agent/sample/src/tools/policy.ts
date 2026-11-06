import type { AgentConfig } from '../config.js';

// Tools that change the machine. Any agent that also reads untrusted text
// (web_search, web_fetch, file_read, stdin, HTTP/MCP requests) can be steered
// into calling these by prompt injection, so they are denied unless the
// operator approves them explicitly.
export const GATED_TOOLS = ['shell', 'file_write', 'file_edit'] as const;
export type GatedToolName = (typeof GATED_TOOLS)[number];

export type ToolPolicy = Pick<AgentConfig, 'approvalPolicy' | 'approvedTools'>;

export function isToolApproved(policy: ToolPolicy, name: GatedToolName): boolean {
  return policy.approvalPolicy === 'never' || policy.approvedTools.includes(name);
}

export function deniedResult(name: GatedToolName) {
  return {
    error:
      `Tool "${name}" was denied: it requires approval and no approver allowed it. ` +
      `Do not retry; continue without it or tell the user what you need.`,
    denied: true,
  };
}

const SECRET_ENV_NAME = /KEY|TOKEN|SECRET|PASSW|CREDENTIAL|AUTH|SESSION|COOKIE|PRIVATE/i;

/**
 * Copy of the environment without variables that look like credentials.
 * AGENT_SHELL_ENV_PASSTHROUGH (comma-separated names, e.g. SSH_AUTH_SOCK) keeps
 * matching variables the operator knowingly hands to approved commands.
 */
export function scrubbedEnv(env: Record<string, string | undefined> = process.env): Record<string, string> {
  const keep = new Set((env.AGENT_SHELL_ENV_PASSTHROUGH ?? '').split(',').map((n) => n.trim()).filter(Boolean));
  const out: Record<string, string> = {};
  for (const [name, value] of Object.entries(env)) {
    if (value === undefined) continue;
    if (SECRET_ENV_NAME.test(name) && !keep.has(name)) continue;
    out[name] = value;
  }
  return out;
}
