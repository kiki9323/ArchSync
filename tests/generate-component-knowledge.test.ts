import { describe, expect, it } from 'vitest';

import { generateComponentKnowledge } from '../src/knowledge/generate-component-knowledge.js';
import type { LlmClient } from '../src/llm/llm-client.js';
import type { ComponentRaw } from '../src/schema/component-raw.js';

describe('generateComponentKnowledge', () => {
  it('generates knowledge by combining raw facts with LLM semantics', async () => {
    // extractor가 만든 RAW라고 가정
    const raw: ComponentRaw = {
      component: 'Button',
      source: 'src/components/ui/button/button.tsx',
      nativeProps: [
        {
          name: 'ButtonHTMLAttributes',
          source: 'React.ButtonHTMLAttributes<HTMLButtonElement>',
          expanded: false,
        },
      ],
      customProps: [
        {
          name: 'variant',
          declaredType: "ButtonVariants['variant']",
          resolvedType: '"filled" | "outline" | "ghost" | undefined',
          values: ['filled', 'outline', 'ghost'],
          optional: true,
          defaultValue: 'filled',
          source: 'src/components/ui/button/button.types.ts',
        },
        {
          name: 'isLoading',
          declaredType: 'boolean',
          resolvedType: 'boolean | undefined',
          optional: true,
          defaultValue: false,
          source: 'src/components/ui/button/button.types.ts',
        },
      ],
    };

    // API 대신 주입하는 가짜 LLM
    const mockLlm: LlmClient = {
      async generateStructured({ prompt, parse }) {
        expect(prompt).toContain('Button');
        expect(prompt).toContain('variant');
        expect(prompt).toContain('isLoading');

        const response = {
          summary: '사용자 액션을 위한 버튼 컴포넌트입니다.',
          props: [
            {
              name: 'variant',
              description: '버튼의 시각적 스타일을 지정합니다.',
            },
            {
              name: 'isLoading',
              description: '버튼의 로딩 상태를 나타냅니다.',
            },
          ],
        };

        // 실제 LlmClient도 이 parse를 거친다
        return parse(response);
      },
    };

    const knowledge = await generateComponentKnowledge(raw, mockLlm);

    expect(knowledge).toEqual({
      component: 'Button',
      summary: '사용자 액션을 위한 버튼 컴포넌트입니다.',
      nativeProps: [
        {
          source: 'React.ButtonHTMLAttributes<HTMLButtonElement>',
        },
      ],
      props: [
        {
          name: 'variant',
          description: '버튼의 시각적 스타일을 지정합니다.',
          type: '"filled" | "outline" | "ghost" | undefined',
          values: ['filled', 'outline', 'ghost'],
          defaultValue: 'filled',
        },
        {
          name: 'isLoading',
          description: '버튼의 로딩 상태를 나타냅니다.',
          type: 'boolean | undefined',
          defaultValue: false,
        },
      ],
      sources: [
        'src/components/ui/button/button.tsx',
        'src/components/ui/button/button.types.ts',
      ],
    });
  });
});
