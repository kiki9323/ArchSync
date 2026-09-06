import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  agentToolDefinitions,
  getComponentContextTool,
  invokeAgentTool,
  searchContextTool,
} from '../src/agent-tool/index.js';
import { getComponentContext } from '../src/context/get-component-context.js';
import { searchComponentContexts } from '../src/context/search-component-contexts.js';
import type { ComponentKnowledge } from '../src/schema/component-knowledge.js';

const buttonKnowledge: ComponentKnowledge = {
  component: 'Button',
  summary: 'A payment action control.',
  nativeProps: [
    {
      source: 'React.ButtonHTMLAttributes<HTMLButtonElement>',
    },
  ],
  nativeAttributes: [
    {
      prop: 'disabled',
      attribute: 'disabled',
    },
  ],
  props: [
    {
      name: 'variant',
      type: '"filled" | "outline" | undefined',
      optional: true,
      values: ['filled', 'outline'],
      defaultValue: 'filled',
    },
  ],
  sources: [
    'src/components/ui/button/button.tsx',
    'src/components/ui/button/button.types.ts',
  ],
};

async function projectWithButton(): Promise<{
  projectRoot: string;
  knowledgePath: string;
}> {
  const projectRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), 'archsync-agent-tool-'),
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

describe('Agent Tool v0.1', () => {
  it('공식 tool 이름과 structured input/output 계약을 노출한다', () => {
    expect(agentToolDefinitions.map((definition) => definition.name)).toEqual([
      'search_context',
      'get_component_context',
      'validate',
    ]);
  });

  it('search_context는 기존 Context Search와 동일한 결과를 반환한다', async () => {
    const { projectRoot } = await projectWithButton();
    const input = { projectPath: projectRoot, query: 'button', limit: 3 };

    expect(await searchContextTool(input)).toEqual(
      await searchComponentContexts(projectRoot, 'button', { limit: 3 }),
    );
  });

  it('get_component_context는 기존 Context Provider와 동일한 결과를 반환한다', async () => {
    const { projectRoot } = await projectWithButton();
    const input = { projectPath: projectRoot, component: 'Button' };

    expect(await getComponentContextTool(input)).toEqual(
      await getComponentContext(projectRoot, 'Button'),
    );
  });

  it('no-match 계약을 그대로 유지한다', async () => {
    const { projectRoot } = await projectWithButton();

    await expect(
      searchContextTool({ projectPath: projectRoot, query: 'calendar' }),
    ).resolves.toEqual({
      status: 'no-match',
      query: 'calendar',
      matches: [],
    });
  });

  it('missing component 계약을 그대로 유지한다', async () => {
    const { projectRoot } = await projectWithButton();

    await expect(
      getComponentContextTool({
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

  it('Tool 호출 전후 Knowledge를 변경하지 않는다', async () => {
    const { projectRoot, knowledgePath } = await projectWithButton();
    const before = await fs.readFile(knowledgePath, 'utf8');

    await searchContextTool({ projectPath: projectRoot, query: 'button' });
    await getComponentContextTool({
      projectPath: projectRoot,
      component: 'Button',
    });

    expect(await fs.readFile(knowledgePath, 'utf8')).toBe(before);
  });

  it('summary 의미나 alias를 Tool layer에서 새로 추론하지 않는다', async () => {
    const { projectRoot } = await projectWithButton();

    await expect(
      searchContextTool({
        projectPath: projectRoot,
        query: 'payment submit 결제',
      }),
    ).resolves.toEqual({
      status: 'no-match',
      query: 'payment submit 결제',
      matches: [],
    });
    await expect(
      fs.access(path.join(projectRoot, '.knowledge', 'raw')),
    ).rejects.toThrow();
    await expect(fs.access(path.join(projectRoot, 'src'))).rejects.toThrow();
  });

  it('같은 Tool 입력은 deterministic한 동일 결과를 반환한다', async () => {
    const { projectRoot } = await projectWithButton();
    const call = {
      name: 'search_context',
      arguments: {
        projectPath: projectRoot,
        query: 'button',
      },
    };

    expect(await invokeAgentTool(call)).toEqual(await invokeAgentTool(call));
  });

  it('demo flow에서 search 후보를 Provider context로 연결할 수 있다', async () => {
    const { projectRoot } = await projectWithButton();
    const search = await invokeAgentTool({
      name: 'search_context',
      arguments: { projectPath: projectRoot, query: 'button' },
    });

    expect(search.status).toBe('matches');

    if (search.status !== 'matches') {
      throw new Error('expected a Button match');
    }

    const context = await invokeAgentTool({
      name: 'get_component_context',
      arguments: {
        projectPath: projectRoot,
        component: search.matches[0].component,
      },
    });

    expect(context).toMatchObject({
      status: 'ready',
      component: 'Button',
      nativeAttributes: [{ prop: 'disabled', attribute: 'disabled' }],
    });
  });
});
