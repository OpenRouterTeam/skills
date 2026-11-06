import { serverTool } from '@openrouter/agent';
import { fileReadTool } from './file-read.js';
import { createFileWriteTool } from './file-write.js';
import { createFileEditTool } from './file-edit.js';
import { globTool } from './glob.js';
import { grepTool } from './grep.js';
import { listDirTool } from './list-dir.js';
import { createShellTool } from './shell.js';
import { myCustomTool } from './custom.js';
import { isToolApproved, type ToolPolicy } from './policy.js';

// `as const` unlocks full type inference for tool calls downstream.
// See: https://openrouter.ai/docs/agent-sdk/call-model/tools
//
// shell, file_write and file_edit return a denial instead of running unless
// config.approvalPolicy is 'never' or the tool is listed in approvedTools.
export const buildTools = (policy: ToolPolicy, cwd: string = process.cwd()) => [
  fileReadTool,
  createFileWriteTool({ approved: isToolApproved(policy, 'file_write') }),
  createFileEditTool({ approved: isToolApproved(policy, 'file_edit') }),
  globTool,
  grepTool,
  listDirTool,
  createShellTool({ approved: isToolApproved(policy, 'shell'), cwd }),
  myCustomTool,

  serverTool({ type: 'openrouter:web_search' }),
  serverTool({ type: 'openrouter:web_fetch' }),
  serverTool({ type: 'openrouter:datetime', parameters: { timezone: 'UTC' } }),
] as const;
