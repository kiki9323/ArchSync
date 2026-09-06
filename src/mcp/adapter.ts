import { invokeAgentTool } from '../agent-tool/invoke-agent-tool.js';
import type {
  GetComponentContextToolInput,
  SearchContextToolInput,
  ValidateToolInput,
} from '../agent-tool/contracts.js';
import type { AgentToolResult } from '../agent-tool/invoke-agent-tool.js';

/**
 * MCP 이름을 protocol-neutral Agent Tool call로 옮기는 thin adapter.
 * 검색, scoring, Context 선택, validation 로직은 이 계층에 없다.
 */
export function callMcpSearchContext(
  input: SearchContextToolInput,
): Promise<AgentToolResult> {
  return invokeAgentTool({
    name: 'search_context',
    arguments: input,
  });
}

export function callMcpGetComponentContext(
  input: GetComponentContextToolInput,
): Promise<AgentToolResult> {
  return invokeAgentTool({
    name: 'get_component_context',
    arguments: input,
  });
}

export function callMcpValidate(
  input: ValidateToolInput,
): Promise<AgentToolResult> {
  return invokeAgentTool({
    name: 'validate',
    arguments: input,
  });
}

export function toMcpResult(result: AgentToolResult) {
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(result),
      },
    ],
    structuredContent: result,
  };
}
