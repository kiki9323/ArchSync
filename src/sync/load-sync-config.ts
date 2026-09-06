import fs from 'node:fs/promises';
import path from 'node:path';

import {
  KnowledgeSyncConfigSchema,
  type KnowledgeSyncConfig,
} from '../schema/knowledge-sync.js';
import { DEFAULT_COMPONENT_ROOTS } from './discover-components.js';

export async function loadSyncConfig(input: {
  projectRoot: string;
}): Promise<KnowledgeSyncConfig> {
  const configPath = path.join(input.projectRoot, 'archsync.config.json');

  try {
    const source = await fs.readFile(configPath, 'utf8');

    return KnowledgeSyncConfigSchema.parse(JSON.parse(source));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return {};
    }

    throw error;
  }
}

export async function loadSyncComponentRoots(input: {
  projectRoot: string;
  cliRoots?: string[];
}): Promise<string[]> {
  if (input.cliRoots?.length) {
    return input.cliRoots;
  }

  const config = await loadSyncConfig({ projectRoot: input.projectRoot });

  return config.componentRoots?.length
    ? config.componentRoots
    : [...DEFAULT_COMPONENT_ROOTS];
}
