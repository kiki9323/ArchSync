import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { buildComponentIndex } from '../src/context/build-component-index.js';
import { searchComponentContexts } from '../src/context/search-component-contexts.js';
import { applyComponentSearchAliases } from '../src/knowledge/apply-search-aliases.js';
import type { ComponentKnowledge } from '../src/schema/component-knowledge.js';

async function projectWithComponents(
  components: Array<string | ComponentKnowledge>,
): Promise<string> {
  const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'archsync-search-'));
  const knowledgeDir = path.join(projectRoot, '.knowledge', 'components');

  await fs.mkdir(knowledgeDir, { recursive: true });

  for (const entry of components) {
    const knowledge: ComponentKnowledge =
      typeof entry === 'string'
        ? {
            component: entry,
            summary: entry === 'Button' ? 'A payment action control.' : undefined,
            nativeProps: [],
            props: [],
            sources: [`src/components/${entry}.tsx`],
          }
        : entry;

    await fs.writeFile(
      path.join(knowledgeDir, `${knowledge.component}.json`),
      JSON.stringify(knowledge),
      'utf8',
    );
  }

  return projectRoot;
}

describe('buildComponentIndex', () => {
  it('Knowledge에서 검색에 필요한 최소 index만 만든다', async () => {
    const projectRoot = await projectWithComponents([
      {
        component: 'Button',
        nativeProps: [],
        props: [],
        sources: ['src/components/Button.tsx'],
        search: {
          aliases: [{ value: '버튼', source: 'config' }],
        },
      },
    ]);

    await expect(buildComponentIndex(projectRoot)).resolves.toEqual([
      {
        component: 'Button',
        tokens: ['button'],
        aliases: [
          {
            value: '버튼',
            tokens: ['버튼'],
            source: 'config',
          },
        ],
        provenance: {
          knowledge: '.knowledge/components/Button.json',
          sources: ['src/components/Button.tsx'],
        },
      },
    ]);
  });
});

describe('searchComponentContexts', () => {
  it('"Button"은 exact match로 Button을 반환한다', async () => {
    const projectRoot = await projectWithComponents(['Button']);
    const result = await searchComponentContexts(projectRoot, 'Button');

    expect(result.status).toBe('matches');
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0]).toMatchObject({
      component: 'Button',
      reasons: expect.arrayContaining([
        {
          kind: 'component-name-exact',
          matched: 'Button',
        },
      ]),
    });
  });

  it('"button"은 case-insensitive match로 Button을 반환한다', async () => {
    const projectRoot = await projectWithComponents(['Button']);
    const result = await searchComponentContexts(projectRoot, 'button');

    expect(result.matches[0]).toMatchObject({
      component: 'Button',
      reasons: expect.arrayContaining([
        {
          kind: 'component-name-case-insensitive',
          matched: 'button',
        },
      ]),
    });
  });

  it('"button modal"은 Button과 Modal을 deterministic 순서로 반환한다', async () => {
    const projectRoot = await projectWithComponents(['Modal', 'Button']);
    const first = await searchComponentContexts(projectRoot, 'button modal');
    const second = await searchComponentContexts(projectRoot, 'button modal');

    expect(first.matches.map((match) => match.component)).toEqual([
      'Button',
      'Modal',
    ]);
    expect(second).toEqual(first);
    expect(first.matches.every((match) => match.reasons.length > 0)).toBe(true);
  });

  it.each(['ConfirmModal', 'confirmModal', 'confirm-modal', 'confirm modal'])(
    'Pascal/camel/kebab normalization: %s → ConfirmModal',
    async (query) => {
      const projectRoot = await projectWithComponents(['ConfirmModal']);
      const result = await searchComponentContexts(projectRoot, query);

      expect(result.matches.map((match) => match.component)).toEqual([
        'ConfirmModal',
      ]);
    },
  );

  it('여러 규칙과 반복 token이 match되어도 component는 하나다', async () => {
    const projectRoot = await projectWithComponents(['Button']);
    const result = await searchComponentContexts(
      projectRoot,
      'Button button BUTTON',
    );

    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].component).toBe('Button');
    expect(
      result.matches[0].reasons.filter(
        (reason) => reason.kind === 'component-name-token',
      ),
    ).toEqual([
      {
        kind: 'component-name-token',
        matched: 'button',
      },
    ]);
  });

  it('관련 없는 query는 no-match다', async () => {
    const projectRoot = await projectWithComponents(['Button', 'Modal']);

    await expect(
      searchComponentContexts(projectRoot, 'calendar table'),
    ).resolves.toEqual({
      status: 'no-match',
      query: 'calendar table',
      matches: [],
    });
  });

  it('summary 의미나 없는 alias를 검색 token으로 추론하지 않는다', async () => {
    const projectRoot = await projectWithComponents(['Button']);

    await expect(
      searchComponentContexts(projectRoot, '결제 저장 payment submit'),
    ).resolves.toEqual({
      status: 'no-match',
      query: '결제 저장 payment submit',
      matches: [],
    });
  });

  it('alias exact match는 query 전체가 alias일 때 성립한다', async () => {
    const projectRoot = await projectWithComponents([
      {
        component: 'Button',
        nativeProps: [],
        props: [],
        sources: ['src/components/Button.tsx'],
        search: {
          aliases: [{ value: 'cta', source: 'config' }],
        },
      },
    ]);
    const result = await searchComponentContexts(projectRoot, 'CTA');

    expect(result).toMatchObject({
      status: 'matches',
      matches: [
        {
          component: 'Button',
          score: 3,
          reasons: [
            {
              kind: 'alias-exact',
              matched: 'cta',
              queryToken: 'cta',
              source: 'config',
            },
          ],
        },
      ],
    });
  });

  it('alias token match는 긴 query 안의 alias phrase를 찾는다', async () => {
    const projectRoot = await projectWithComponents([
      {
        component: 'Button',
        nativeProps: [],
        props: [],
        sources: ['src/components/Button.tsx'],
        search: {
          aliases: [{ value: '버튼', source: 'config' }],
        },
      },
    ]);
    const result = await searchComponentContexts(
      projectRoot,
      '저장 버튼 추가해줘',
    );

    expect(result).toMatchObject({
      status: 'matches',
      matches: [
        {
          component: 'Button',
          score: 3,
          reasons: [
            {
              kind: 'alias-token',
              matched: '버튼',
              queryToken: '버튼',
              source: 'config',
            },
          ],
        },
      ],
    });
  });

  it('한글 multi-word alias는 전체 phrase만 매칭한다', async () => {
    const projectRoot = await projectWithComponents([
      {
        component: 'Button',
        nativeProps: [],
        props: [],
        sources: ['src/components/Button.tsx'],
        search: {
          aliases: [{ value: '버튼', source: 'config' }],
        },
      },
      {
        component: 'LinkButton',
        nativeProps: [],
        props: [],
        sources: ['src/components/LinkButton.tsx'],
        search: {
          aliases: [{ value: '링크 버튼', source: 'config' }],
        },
      },
    ]);

    await expect(
      searchComponentContexts(projectRoot, '링크 버튼 추가해줘'),
    ).resolves.toMatchObject({
      status: 'matches',
      matches: [
        { component: 'LinkButton', score: 4 },
        { component: 'Button', score: 3 },
      ],
    });

    await expect(
      searchComponentContexts(projectRoot, '저장 버튼 추가해줘'),
    ).resolves.toMatchObject({
      status: 'matches',
      matches: [{ component: 'Button', score: 3 }],
    });
  });

  it('존재하지 않는 alias는 추론하지 않고 no-match다', async () => {
    const projectRoot = await projectWithComponents([
      {
        component: 'Button',
        nativeProps: [],
        props: [],
        sources: ['src/components/Button.tsx'],
        search: {
          aliases: [{ value: '버튼', source: 'config' }],
        },
      },
    ]);

    await expect(
      searchComponentContexts(projectRoot, '저장 액션 추가해줘'),
    ).resolves.toEqual({
      status: 'no-match',
      query: '저장 액션 추가해줘',
      matches: [],
    });
  });

  it('동일 query는 항상 같은 순서를 반환한다', async () => {
    const projectRoot = await projectWithComponents([
      {
        component: 'Button',
        nativeProps: [],
        props: [],
        sources: ['src/components/Button.tsx'],
        search: {
          aliases: [{ value: '버튼', source: 'config' }],
        },
      },
      {
        component: 'LinkButton',
        nativeProps: [],
        props: [],
        sources: ['src/components/LinkButton.tsx'],
        search: {
          aliases: [{ value: '링크 버튼', source: 'config' }],
        },
      },
    ]);
    const first = await searchComponentContexts(projectRoot, '버튼');
    const second = await searchComponentContexts(projectRoot, '버튼');

    expect(second).toEqual(first);
    expect(first.matches.map((match) => match.component)).toEqual(['Button']);
  });

  it('Source, RAW, LLM 없이 Knowledge JSON만 검색한다', async () => {
    const projectRoot = await projectWithComponents(['Input']);

    await expect(searchComponentContexts(projectRoot, 'input')).resolves.toMatchObject({
      status: 'matches',
      matches: [{ component: 'Input' }],
    });
    await expect(
      fs.access(path.join(projectRoot, '.knowledge', 'raw')),
    ).rejects.toThrow();
    await expect(fs.access(path.join(projectRoot, 'src'))).rejects.toThrow();
  });

  it('top-k 제한을 score와 이름 tie-break 이후 적용한다', async () => {
    const projectRoot = await projectWithComponents([
      'Button',
      'ButtonGroup',
      'SaveButton',
    ]);
    const result = await searchComponentContexts(projectRoot, 'button', {
      limit: 2,
    });

    expect(result.matches.map((match) => match.component)).toEqual([
      'Button',
      'ButtonGroup',
    ]);
  });
});

describe('applyComponentSearchAliases', () => {
  it('중복 alias를 제거하고 knowledge source를 우선한다', () => {
    const knowledge = applyComponentSearchAliases(
      {
        component: 'Button',
        nativeProps: [],
        props: [],
        sources: ['src/components/Button.tsx'],
        search: {
          aliases: [{ value: '버튼', source: 'knowledge' }],
        },
      },
      {
        configAliases: ['버튼', 'button', 'Button', 'cta', 'cta'],
      },
    );

    expect(knowledge.search?.aliases).toEqual([
      { value: 'button', source: 'config' },
      { value: 'cta', source: 'config' },
      { value: '버튼', source: 'knowledge' },
    ]);
  });

  it('이전 Knowledge의 knowledge alias만 보존하고 config alias는 갱신한다', () => {
    const knowledge = applyComponentSearchAliases(
      {
        component: 'Button',
        nativeProps: [],
        props: [],
        sources: ['src/components/Button.tsx'],
      },
      {
        configAliases: ['cta'],
        previousKnowledge: {
          component: 'Button',
          nativeProps: [],
          props: [],
          sources: ['src/components/Button.tsx'],
          search: {
            aliases: [
              { value: 'old', source: 'config' },
              { value: '명시', source: 'knowledge' },
            ],
          },
        },
      },
    );

    expect(knowledge.search?.aliases).toEqual([
      { value: 'cta', source: 'config' },
      { value: '명시', source: 'knowledge' },
    ]);
  });
});
