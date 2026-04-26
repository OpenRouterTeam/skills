import { serverTool } from '@openrouter/agent';
import { fileReadTool } from './file-read.js';
import { fileWriteTool } from './file-write.js';
import { fileEditTool } from './file-edit.js';
import { globTool } from './glob.js';
import { grepTool } from './grep.js';
import { listDirTool } from './list-dir.js';
import { shellTool } from './shell.js';
import { myCustomTool } from './custom.js';

// `as const` unlocks full type inference for tool calls downstream.
// See: https://openrouter.ai/docs/agent-sdk/call-model/tools
export const tools = [
  fileReadTool,
  fileWriteTool,
  fileEditTool,
  globTool,
  grepTool,
  listDirTool,
  shellTool,
  myCustomTool,

  serverTool({ type: 'openrouter:web_search' }),
  serverTool({ type: 'openrouter:web_fetch' }),
  serverTool({ type: 'openrouter:datetime', parameters: { timezone: 'UTC' } }),
] as const;
