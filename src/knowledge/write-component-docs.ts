import fs from 'node:fs/promises';
import path from 'node:path';

import type { ComponentKnowledge } from '../schema/component-knowledge.js';
import { knowledgeJsonDirectory } from './artifact-policy.js';
import { renderComponentMarkdown } from './render-component-markdown.js';

/**
 * Knowledge JSON에서 파생 Markdown만 렌더한다.
 * Source / RAW를 다시 읽거나 설명을 추가하지 않는다.
 */
export async function writeComponentDocs(
  projectRoot: string,
  knowledge: ComponentKnowledge,
): Promise<string> {
  const outputDir = path.join(projectRoot, ...knowledgeJsonDirectory);

  await fs.mkdir(outputDir, { recursive: true });

  const markdownPath = path.join(outputDir, `${knowledge.component}.md`);

  await fs.writeFile(
    markdownPath,
    `${renderComponentMarkdown(knowledge)}\n`,
    'utf8',
  );

  return markdownPath;
}
