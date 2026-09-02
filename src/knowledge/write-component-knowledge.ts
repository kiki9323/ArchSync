import fs from 'node:fs/promises';
import path from 'node:path';

import type { ComponentKnowledge } from '../schema/component-knowledge.js';
import { renderComponentMarkdown } from './render-component-markdown.js';

export async function writeComponentKnowledge(
  projectRoot: string,
  knowledge: ComponentKnowledge,
): Promise<void> {
  const outputDir = path.join(projectRoot, '.knowledge', 'components');

  await fs.mkdir(outputDir, { recursive: true });

  const jsonPath = path.join(outputDir, `${knowledge.component}.json`);
  const markdownPath = path.join(outputDir, `${knowledge.component}.md`);

  await fs.writeFile(jsonPath, `${JSON.stringify(knowledge, null, 2)}\n`, 'utf8');
  await fs.writeFile(markdownPath, `${renderComponentMarkdown(knowledge)}\n`, 'utf8');
}
