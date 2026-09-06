import fs from 'node:fs/promises';
import path from 'node:path';

import { readComponentKnowledge } from '../knowledge/read-component-knowledge.js';
import {
  ComponentIndexEntrySchema,
  type ComponentIndexEntry,
} from '../schema/component-search.js';
import {
  componentNameTokens,
  queryTokenSequence,
} from './component-name-tokens.js';

/**
 * 검색에 필요한 최소 필드만 Knowledge SSOT에서 고른다.
 * Source / RAW / Markdown은 읽지 않는다.
 */
export async function buildComponentIndex(
  projectPath: string,
): Promise<ComponentIndexEntry[]> {
  const projectRoot = path.resolve(projectPath);
  const componentsDir = path.join(projectRoot, '.knowledge', 'components');
  const entries = await fs.readdir(componentsDir, { withFileTypes: true }).catch(
    (error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') {
        return [];
      }

      throw error;
    },
  );
  const fileComponents = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => entry.name.slice(0, -'.json'.length))
    .sort(compareText);
  const index = new Map<string, ComponentIndexEntry>();

  for (const fileComponent of fileComponents) {
    const result = await readComponentKnowledge(projectRoot, fileComponent);

    if (result.status === 'missing') {
      continue;
    }

    const { knowledge } = result;

    if (index.has(knowledge.component)) {
      continue;
    }

    index.set(
      knowledge.component,
      ComponentIndexEntrySchema.parse({
        component: knowledge.component,
        tokens: componentNameTokens(knowledge.component),
        aliases: (knowledge.search?.aliases ?? []).map((alias) => ({
          value: alias.value,
          tokens: queryTokenSequence(alias.value),
          source: alias.source,
        })),
        provenance: {
          knowledge: result.path,
          sources: knowledge.sources,
        },
      }),
    );
  }

  return [...index.values()].sort((left, right) =>
    compareText(left.component, right.component),
  );
}

function compareText(left: string, right: string): number {
  const normalizedLeft = left.toLowerCase();
  const normalizedRight = right.toLowerCase();

  if (normalizedLeft < normalizedRight) {
    return -1;
  }

  if (normalizedLeft > normalizedRight) {
    return 1;
  }

  return left < right ? -1 : left > right ? 1 : 0;
}
