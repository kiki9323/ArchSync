import { describe, expect, it } from 'vitest';

import { buildKnowledgeInput } from '../src/knowledge/build-knowledge-input.js';
import type { ComponentRaw } from '../src/schema/component-raw.js';

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
      name: 'fullWidth',
      declaredType: "ButtonVariants['fullWidth']",
      resolvedType: 'boolean | undefined',
      optional: true,
      defaultValue: false,
      source: 'src/components/ui/button/button.types.ts',
    },
    {
      name: 'color',
      declaredType: "ButtonVariants['color']",
      resolvedType: 'string | undefined',
      optional: true,
      source: 'src/components/ui/button/button.types.ts',
    },
  ],
};

describe('buildKnowledgeInput', () => {
  it('selects LLM facts from RAW', () => {
    expect(buildKnowledgeInput(raw)).toEqual({
      component: 'Button',
      nativeProps: ['React.ButtonHTMLAttributes<HTMLButtonElement>'],
      props: [
        {
          name: 'variant',
          type: '"filled" | "outline" | "ghost" | undefined',
          values: ['filled', 'outline', 'ghost'],
          defaultValue: 'filled',
        },
        {
          name: 'fullWidth',
          type: 'boolean | undefined',
          defaultValue: false,
        },
        {
          name: 'color',
          type: 'string | undefined',
        },
      ],
      sources: [
        'src/components/ui/button/button.tsx',
        'src/components/ui/button/button.types.ts',
      ],
    });
  });
});
