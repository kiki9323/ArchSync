import { describe, expect, it } from 'vitest';

import { createComponentKnowledge } from '../src/knowledge/create-component-knowledge.js';
import { renderComponentMarkdown } from '../src/knowledge/render-component-markdown.js';
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
      name: 'isLoading',
      declaredType: 'boolean',
      resolvedType: 'boolean | undefined',
      optional: true,
      defaultValue: false,
      source: 'src/components/ui/button/button.types.ts',
    },
  ],
};

describe('createComponentKnowledge', () => {
  it('builds knowledge from RAW without an LLM', () => {
    const knowledge = createComponentKnowledge(raw);

    expect(knowledge.component).toBe('Button');
    expect(knowledge.summary).toBeUndefined();
    expect(knowledge.props.find((prop) => prop.name === 'variant')).toMatchObject({
      type: '"filled" | "outline" | "ghost" | undefined',
      optional: true,
      values: ['filled', 'outline', 'ghost'],
      defaultValue: 'filled',
    });
    expect(knowledge.props.find((prop) => prop.name === 'variant')).not.toHaveProperty(
      'description',
    );
  });
});

describe('renderComponentMarkdown', () => {
  it('renders deterministic Button.md from knowledge facts', () => {
    const markdown = renderComponentMarkdown(createComponentKnowledge(raw));

    expect(markdown).toBe(`# Button

## Props

### variant

- Type: \`"filled" | "outline" | "ghost" | undefined\`
- Optional: yes
- Allowed values: \`filled\`, \`outline\`, \`ghost\`
- Default: \`filled\`

### isLoading

- Type: \`boolean | undefined\`
- Optional: yes
- Default: \`false\`

## Native Props

- \`React.ButtonHTMLAttributes<HTMLButtonElement>\`

## Sources

- \`src/components/ui/button/button.tsx\`
- \`src/components/ui/button/button.types.ts\``);
  });

  it('renders behavior only when usage evidence exists', () => {
    const markdown = renderComponentMarkdown({
      component: 'Chip',
      nativeProps: [],
      sources: ['chip.tsx'],
      props: [
        {
          name: 'tone',
          type: 'string',
          optional: true,
          behavior: 'Sets the visual tone of the chip.',
        },
        {
          name: 'label',
          type: 'string',
          optional: false,
        },
      ],
    });

    expect(markdown).toContain('### tone');
    expect(markdown).toContain('- Behavior: Sets the visual tone of the chip.');

    const labelSection = markdown.split('### label')[1] ?? '';
    expect(labelSection).not.toContain('- Behavior:');
  });
});
