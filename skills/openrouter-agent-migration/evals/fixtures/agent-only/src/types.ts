import type { CallModelInput } from '@openrouter/sdk/lib/async-params';
import { ModelResult } from '@openrouter/sdk/lib/model-result';
import type { Tool, ToolWithGenerator } from '@openrouter/sdk/lib/tool-types';

export type AgentInput = CallModelInput;

export function isModelResult(value: unknown): value is ModelResult<readonly Tool[]> {
  return value instanceof ModelResult;
}

// NOTE: ToolWithGenerator uses the SDK's internal zod v4 types via @openrouter/sdk/lib/tool-types
export type StreamingTool = ToolWithGenerator;
