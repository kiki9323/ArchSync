import type { ComponentContextResult } from '../schema/component-context.js';
import type { ComponentSearchResult } from '../schema/component-search.js';
import type { ComponentValidationResult } from '../schema/component-validation.js';
import {
  AgentToolCallSchema,
} from './contracts.js';
import {
  getComponentContextTool,
  searchContextTool,
  validateTool,
} from './tools.js';

export type AgentToolResult =
  | ComponentSearchResult
  | ComponentContextResult
  | ComponentValidationResult;

/**
 * CLI/MCP/Codex/Claude adapter가 공통으로 감쌀 수 있는 protocol-neutral dispatcher.
 */
export async function invokeAgentTool(
  call: unknown,
): Promise<AgentToolResult> {
  const parsed = AgentToolCallSchema.parse(call);

  switch (parsed.name) {
    case 'search_context':
      return searchContextTool(parsed.arguments);
    case 'get_component_context':
      return getComponentContextTool(parsed.arguments);
    case 'validate':
      return validateTool(parsed.arguments);
  }
}
