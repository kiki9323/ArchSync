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
  nativeBooleanAttributes: [
    {
      prop: 'disabled',
      attribute: 'disabled',
      source: 'React.ButtonHTMLAttributes<HTMLButtonElement>',
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
      usage: [
        {
          kind: 'conditional',
          context: 'jsx',
          expression: 'isLoading ? <Spinner /> : children',
        },
      ],
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
    expect(knowledge.props.find((prop) => prop.name === 'variant')?.behavior).toBeUndefined();
    expect(knowledge.props.find((prop) => prop.name === 'isLoading')?.behavior).toEqual([
      {
        kind: 'conditional-render',
        evidence: 'isLoading ? <Spinner /> : children',
      },
    ]);
    expect(knowledge.nativeAttributes).toEqual([{ prop: 'disabled', attribute: 'disabled' }]);
    expect(knowledge.props.some((prop) => prop.name === 'disabled')).toBe(false);
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
- Behavior:
  - Conditional render

## Native Props

- \`React.ButtonHTMLAttributes<HTMLButtonElement>\`
- Observable: \`disabled\`

## Sources

- \`src/components/ui/button/button.tsx\`
- \`src/components/ui/button/button.types.ts\``);
  });

  it('renders structured behavior kinds without interpreting meaning', () => {
    const markdown = renderComponentMarkdown({
      component: 'Chip',
      nativeProps: [],
      sources: ['chip.tsx'],
      props: [
        {
          name: 'tone',
          type: 'string',
          optional: true,
          behavior: [
            {
              kind: 'conditional-render',
              evidence: 'tone && <Badge />',
            },
            {
              kind: 'conditional-logic',
              evidence: 'tone && compact',
            },
          ],
        },
        {
          name: 'label',
          type: 'string',
          optional: false,
        },
      ],
    });

    expect(markdown).toContain('### tone');
    expect(markdown).toContain('- Behavior:');
    expect(markdown).toContain('  - Conditional render');
    expect(markdown).toContain('  - Conditional logic');
    expect(markdown).not.toContain('Sets the visual tone');
    expect(markdown).not.toContain('tone && <Badge />');

    const labelSection = markdown.split('### label')[1] ?? '';
    expect(labelSection).not.toContain('- Behavior:');
  });

  it('renders React prop to HTML attribute mapping when names differ', () => {
    const markdown = renderComponentMarkdown({
      component: 'Input',
      nativeProps: [{ source: 'React.InputHTMLAttributes<HTMLInputElement>' }],
      nativeAttributes: [{ prop: 'readOnly', attribute: 'readonly' }],
      sources: ['input.tsx'],
      props: [],
    });

    expect(markdown).toContain('- Observable: `readOnly` → `readonly`');
  });
});
