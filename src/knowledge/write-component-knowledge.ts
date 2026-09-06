import fs from 'node:fs/promises';
import path from 'node:path';

import type { ComponentKnowledge } from '../schema/component-knowledge.js';
import { knowledgeJsonDirectory } from './artifact-policy.js';

/**
 * Persistent Knowledge SSOT writer.
 * Markdown은 여기서 쓰지 않는다. 필요하면 writeComponentDocs를 호출한다.
 */
export async function writeComponentKnowledge(
  projectRoot: string,
  knowledge: ComponentKnowledge,
): Promise<string> {
  const outputDir = path.join(projectRoot, ...knowledgeJsonDirectory);

  await fs.mkdir(outputDir, { recursive: true });

  const jsonPath = path.join(outputDir, `${knowledge.component}.json`);

  await fs.writeFile(jsonPath, `${JSON.stringify(knowledge, null, 2)}\n`, 'utf8');

  return jsonPath;
}
