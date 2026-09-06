import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { getComponentContext } from '../src/context/get-component-context.js';
import type { ComponentKnowledge } from '../src/schema/component-knowledge.js';

const buttonKnowledge: ComponentKnowledge = {
  component: 'Button',
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
    {
      name: 'isLoading',
      type: 'boolean | undefined',
      optional: true,
      defaultValue: false,
      behavior: [
        {
          kind: 'conditional-render',
          evidence: 'isLoading ? <Spinner /> : children',
        },
      ],
    },
  ],
  sources: [
    'src/components/ui/button/button.tsx',
    'src/components/ui/button/button.types.ts',
  ],
};

async function projectWithKnowledge(): Promise<string> {
  const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'archsync-context-'));
  const knowledgeDir = path.join(projectRoot, '.knowledge', 'components');

  await fs.mkdir(knowledgeDir, { recursive: true });
  await fs.writeFile(
    path.join(knowledgeDir, 'Button.json'),
    JSON.stringify(buttonKnowledge),
    'utf8',
  );

  return projectRoot;
}

describe('getComponentContext', () => {
  it('Button Knowledge에서 compact agent context를 만든다', async () => {
    const projectRoot = await projectWithKnowledge();
    const result = await getComponentContext(projectRoot, 'Button');

    expect(result.status).toBe('ready');

    if (result.status !== 'ready') {
      throw new Error('expected ready context');
    }

    expect(result.component).toBe('Button');
    expect(result.props.find((prop) => prop.name === 'variant')?.values).toEqual([
      'filled',
      'outline',
    ]);
    expect(result.props.find((prop) => prop.name === 'isLoading')?.behavior).toEqual([
      {
        kind: 'conditional-render',
        evidence: 'isLoading ? <Spinner /> : children',
      },
    ]);
    expect(result.nativeAttributes).toEqual([
      {
        prop: 'disabled',
        attribute: 'disabled',
      },
    ]);
    expect(result.provenance).toEqual({
      knowledge: '.knowledge/components/Button.json',
      sources: buttonKnowledge.sources,
    });
  });

  it('Knowledge에 없는 prop이나 behavior를 만들지 않는다', async () => {
    const projectRoot = await projectWithKnowledge();
    const result = await getComponentContext(projectRoot, 'Button');

    expect(result.status).toBe('ready');

    if (result.status !== 'ready') {
      throw new Error('expected ready context');
    }

    expect(result.props).toEqual(buttonKnowledge.props);
    expect(result.props.map((prop) => prop.name)).toEqual(['variant', 'isLoading']);
    expect(
      result.props.flatMap((prop) => prop.behavior ?? []),
    ).toEqual(buttonKnowledge.props.flatMap((prop) => prop.behavior ?? []));
    expect(result).not.toHaveProperty('constraints');
    expect(result).not.toHaveProperty('nativeProps');
  });

  it('RAW나 Source 없이 Knowledge JSON만으로 동작한다', async () => {
    const projectRoot = await projectWithKnowledge();

    await expect(getComponentContext(projectRoot, 'Button')).resolves.toMatchObject({
      status: 'ready',
      component: 'Button',
    });
  });

  it('없는 component는 비슷한 이름을 추측하지 않고 missing을 반환한다', async () => {
    const projectRoot = await projectWithKnowledge();

    await expect(getComponentContext(projectRoot, 'FooButton')).resolves.toEqual({
      status: 'missing',
      component: 'FooButton',
      reason: 'knowledge-not-found',
      provenance: {
        knowledge: '.knowledge/components/FooButton.json',
      },
    });
  });
});
