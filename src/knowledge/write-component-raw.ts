import fs from 'node:fs/promises';
import path from 'node:path';

import type { ComponentRaw } from '../schema/component-raw.js';
import { rawEvidenceDirectory } from './artifact-policy.js';

/**
 * RAW evidence cache.
 * 소비자는 이 파일을 읽지 않는다. Knowledge가 틀렸을 때 extractor/transformer를 가르는 용도다.
 */
export async function writeComponentRaw(
  projectRoot: string,
  raw: ComponentRaw,
): Promise<void> {
  const outputDir = path.join(projectRoot, ...rawEvidenceDirectory);

  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(
    path.join(outputDir, `${raw.component}.json`),
    `${JSON.stringify(raw, null, 2)}\n`,
    'utf8',
  );
}
