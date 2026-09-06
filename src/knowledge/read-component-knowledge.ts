import fs from 'node:fs/promises';
import path from 'node:path';

import {
  ComponentKnowledgeSchema,
  type ComponentKnowledge,
} from '../schema/component-knowledge.js';

export interface FoundComponentKnowledge {
  status: 'found';
  knowledge: ComponentKnowledge;
  path: string;
}

export interface MissingComponentKnowledge {
  status: 'missing';
  path: string;
}

export type ReadComponentKnowledgeResult =
  | FoundComponentKnowledge
  | MissingComponentKnowledge;

/**
 * Knowledge 소비자들의 공통 SSOT reader.
 * Source / RAW / Markdown을 보지 않고 .knowledge/components의 JSON만 읽는다.
 */
export async function readComponentKnowledge(
  projectPath: string,
  component: string,
): Promise<ReadComponentKnowledgeResult> {
  const projectRoot = path.resolve(projectPath);
  const knowledgePath = path.join(
    projectRoot,
    '.knowledge',
    'components',
    `${component}.json`,
  );
  const relativePath = toProjectPath(projectRoot, knowledgePath);

  if (!isComponentName(component)) {
    return { status: 'missing', path: relativePath };
  }

  let source: string;

  try {
    source = await fs.readFile(knowledgePath, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { status: 'missing', path: relativePath };
    }

    throw error;
  }

  return {
    status: 'found',
    knowledge: ComponentKnowledgeSchema.parse(JSON.parse(source)),
    path: relativePath,
  };
}

function isComponentName(component: string): boolean {
  return /^[A-Za-z_$][\w$.-]*$/.test(component);
}

function toProjectPath(projectRoot: string, filePath: string): string {
  return path.relative(projectRoot, filePath).split(path.sep).join('/');
}
