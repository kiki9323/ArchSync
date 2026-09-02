import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { createComponentKnowledge } from '../src/knowledge/create-component-knowledge.js';
import { writeComponentKnowledge } from '../src/knowledge/write-component-knowledge.js';
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
  ],
};

describe('writeComponentKnowledge', () => {
  it('writes knowledge json and markdown under the target project', async () => {
    const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'archsync-knowledge-'));
    const knowledge = createComponentKnowledge(raw);

    await writeComponentKnowledge(projectRoot, knowledge);

    const jsonPath = path.join(projectRoot, '.knowledge', 'components', 'Button.json');
    const markdownPath = path.join(projectRoot, '.knowledge', 'components', 'Button.md');

    const json = JSON.parse(await fs.readFile(jsonPath, 'utf8'));
    const markdown = await fs.readFile(markdownPath, 'utf8');

    expect(json.component).toBe('Button');
    expect(markdown).toContain('# Button');
    expect(markdown).toContain('### variant');
  });
});
