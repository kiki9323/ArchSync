import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { describe, expect, it } from 'vitest';

import type { ComponentKnowledge } from '../src/schema/component-knowledge.js';

async function projectWithButton(): Promise<string> {
  const projectRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), 'archsync-mcp-stdio-'),
  );
  const knowledgeDir = path.join(projectRoot, '.knowledge', 'components');
  const knowledge: ComponentKnowledge = {
    component: 'Button',
    nativeProps: [],
    nativeAttributes: [{ prop: 'disabled', attribute: 'disabled' }],
    props: [],
    sources: ['src/components/ui/button/button.tsx'],
  };

  await fs.mkdir(knowledgeDir, { recursive: true });
  await fs.writeFile(
    path.join(knowledgeDir, 'Button.json'),
    JSON.stringify(knowledge),
    'utf8',
  );

  return projectRoot;
}

describe('ArchSync MCP stdio server', () => {
  it('두 MCP tool을 노출하고 structured JSON을 반환한다', async () => {
    const projectRoot = await projectWithButton();
    const transport = new StdioClientTransport({
      command: path.resolve('node_modules/.bin/tsx'),
      args: [path.resolve('src/mcp.ts')],
      cwd: path.resolve('.'),
      stderr: 'pipe',
    });
    const client = new Client({
      name: 'archsync-test-client',
      version: '0.1.0',
    });

    try {
      await client.connect(transport);

      const tools = await client.listTools();
      expect(tools.tools.map((tool) => tool.name)).toEqual([
        'archsync_search_context',
        'archsync_get_component_context',
        'archsync_validate',
      ]);

      const search = await client.callTool({
        name: 'archsync_search_context',
        arguments: {
          projectPath: projectRoot,
          query: 'button',
        },
      });
      expect(search.structuredContent).toMatchObject({
        status: 'matches',
        matches: [{ component: 'Button' }],
      });

      const context = await client.callTool({
        name: 'archsync_get_component_context',
        arguments: {
          projectPath: projectRoot,
          component: 'Button',
        },
      });
      expect(context.structuredContent).toMatchObject({
        status: 'ready',
        component: 'Button',
        nativeAttributes: [{ prop: 'disabled', attribute: 'disabled' }],
      });
    } finally {
      await transport.close();
    }
  });
});
