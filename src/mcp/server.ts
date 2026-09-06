import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import {
  GetComponentContextToolInputSchema,
  SearchContextToolInputSchema,
  ValidateToolInputSchema,
} from '../agent-tool/contracts.js';
import {
  callMcpGetComponentContext,
  callMcpSearchContext,
  callMcpValidate,
  toMcpResult,
} from './adapter.js';

export function createArchSyncMcpServer(): McpServer {
  const server = new McpServer({
    name: 'archsync',
    version: '0.1.0',
  });

  server.registerTool(
    'archsync_search_context',
    {
      description:
        'Find explainable component candidates from ArchSync Knowledge.',
      inputSchema: SearchContextToolInputSchema.shape,
    },
    async (input) => toMcpResult(await callMcpSearchContext(input)),
  );

  server.registerTool(
    'archsync_get_component_context',
    {
      description:
        'Return compact ArchSync Knowledge context for one exact component.',
      inputSchema: GetComponentContextToolInputSchema.shape,
    },
    async (input) => toMcpResult(await callMcpGetComponentContext(input)),
  );

  server.registerTool(
    'archsync_validate',
    {
      description:
        'Validate component usage against existing ArchSync Knowledge.',
      inputSchema: ValidateToolInputSchema.shape,
    },
    async (input) => toMcpResult(await callMcpValidate(input)),
  );

  return server;
}
