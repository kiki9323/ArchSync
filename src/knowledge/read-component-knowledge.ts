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
 * `.knowledge/components/*.json` 파일 이름만 나열한다.
 * Knowledge를 해석하지 않는다.
 */
export async function listComponentKnowledgeNames(
  projectPath: string,
): Promise<string[]> {
  const projectRoot = path.resolve(projectPath);
  const directory = path.join(projectRoot, '.knowledge', 'components');

  try {
    const entries = await fs.readdir(directory);
    return entries
      .filter((entry) => entry.endsWith('.json'))
      .map((entry) => entry.slice(0, -'.json'.length))
      .filter(isComponentName)
      .sort();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }

    throw error;
  }
}

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
