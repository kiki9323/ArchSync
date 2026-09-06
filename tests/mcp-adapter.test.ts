import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { invokeAgentTool } from '../src/agent-tool/invoke-agent-tool.js';
import {
  callMcpGetComponentContext,
  callMcpSearchContext,
  callMcpValidate,
  toMcpResult,
} from '../src/mcp/adapter.js';
import type { ComponentKnowledge } from '../src/schema/component-knowledge.js';

const buttonKnowledge: ComponentKnowledge = {
  component: 'Button',
  summary: 'A payment action control.',
  nativeProps: [],
  nativeAttributes: [{ prop: 'disabled', attribute: 'disabled' }],
  props: [
    {
      name: 'variant',
      type: '"filled" | "outline" | undefined',
      optional: true,
      values: ['filled', 'outline'],
    },
  ],
  sources: ['src/components/ui/button/button.tsx'],
};

async function projectWithButton(): Promise<{
  projectRoot: string;
  knowledgePath: string;
}> {
  const projectRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), 'archsync-mcp-'),
  );
  const knowledgeDir = path.join(projectRoot, '.knowledge', 'components');
  const knowledgePath = path.join(knowledgeDir, 'Button.json');

  await fs.mkdir(knowledgeDir, { recursive: true });
  await fs.writeFile(
    knowledgePath,
    JSON.stringify(buttonKnowledge, null, 2),
    'utf8',
  );

  return { projectRoot, knowledgePath };
}

describe('MCP Adapter v0.1', () => {
  it('search 결과가 protocol-neutral Agent Tool과 동일하다', async () => {
    const { projectRoot } = await projectWithButton();
    const input = { projectPath: projectRoot, query: 'button', limit: 5 };

    expect(await callMcpSearchContext(input)).toEqual(
      await invokeAgentTool({
        name: 'search_context',
        arguments: input,
      }),
    );
  });

  it('component context 결과가 Agent Tool과 동일하다', async () => {
    const { projectRoot } = await projectWithButton();
    const input = { projectPath: projectRoot, component: 'Button' };

    expect(await callMcpGetComponentContext(input)).toEqual(
      await invokeAgentTool({
        name: 'get_component_context',
        arguments: input,
      }),
    );
  });

  it('no-match와 missing 계약을 유지한다', async () => {
    const { projectRoot } = await projectWithButton();

    await expect(
      callMcpSearchContext({ projectPath: projectRoot, query: 'calendar' }),
    ).resolves.toEqual({
      status: 'no-match',
      query: 'calendar',
      matches: [],
    });
    await expect(
      callMcpGetComponentContext({
        projectPath: projectRoot,
        component: 'Modal',
      }),
    ).resolves.toEqual({
      status: 'missing',
      component: 'Modal',
      reason: 'knowledge-not-found',
      provenance: {
        knowledge: '.knowledge/components/Modal.json',
      },
    });
  });

  it('structuredContent와 text에 같은 Agent Tool 결과를 담는다', async () => {
    const { projectRoot } = await projectWithButton();
    const result = await callMcpSearchContext({
      projectPath: projectRoot,
      query: 'button',
    });
    const mcpResult = toMcpResult(result);

    expect(mcpResult.structuredContent).toEqual(result);
    expect(JSON.parse(mcpResult.content[0].text)).toEqual(result);
  });

  it('호출 전후 Knowledge를 변경하지 않는다', async () => {
    const { projectRoot, knowledgePath } = await projectWithButton();
    const before = await fs.readFile(knowledgePath, 'utf8');

    await callMcpSearchContext({ projectPath: projectRoot, query: 'button' });
    await callMcpGetComponentContext({
      projectPath: projectRoot,
      component: 'Button',
    });

    expect(await fs.readFile(knowledgePath, 'utf8')).toBe(before);
  });

  it('summary 의미를 검색하거나 Search 로직을 Adapter에 복제하지 않는다', async () => {
    const { projectRoot } = await projectWithButton();
    const adapterSource = await fs.readFile(
      path.resolve('src/mcp/adapter.ts'),
      'utf8',
    );

    await expect(
      callMcpSearchContext({
        projectPath: projectRoot,
        query: 'payment 결제',
      }),
    ).resolves.toEqual({
      status: 'no-match',
      query: 'payment 결제',
      matches: [],
    });
    expect(adapterSource).not.toContain('searchComponentContexts');
    expect(adapterSource).not.toContain('getComponentContext(');
    expect(adapterSource).not.toContain('validateProjectUsage');
    expect(adapterSource).not.toContain('validateComponentUsage');
    expect(adapterSource).not.toContain('compareRuntime');
    expect(adapterSource).not.toContain('/extractor/');
    expect(adapterSource).not.toContain('/llm/');
  });

  it('validate 결과가 protocol-neutral Agent Tool과 동일하다', async () => {
    const { projectRoot } = await projectWithButton();
    const file = 'src/pages/demo.tsx';

    await fs.mkdir(path.join(projectRoot, 'src', 'pages'), { recursive: true });
    await fs.writeFile(
      path.join(projectRoot, file),
      `export function Demo() { return <Button variant="filled" />; }\n`,
      'utf8',
    );

    const input = {
      projectPath: projectRoot,
      component: 'Button',
      file,
    };

    expect(await callMcpValidate(input)).toEqual(
      await invokeAgentTool({
        name: 'validate',
        arguments: input,
      }),
    );
  });
});
