import fs from 'node:fs/promises';
import path from 'node:path';

import { syncManifestPath } from '../knowledge/artifact-policy.js';
import {
  SyncManifestSchema,
  type SyncManifest,
} from '../schema/sync-manifest.js';

export async function readSyncManifest(
  projectRoot: string,
): Promise<SyncManifest | undefined> {
  const manifestFile = path.join(projectRoot, ...syncManifestPath);

  try {
    const source = await fs.readFile(manifestFile, 'utf8');

    return SyncManifestSchema.parse(JSON.parse(source));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return undefined;
    }

    throw error;
  }
}

export async function writeSyncManifest(
  projectRoot: string,
  manifest: SyncManifest,
): Promise<string> {
  const parsed = SyncManifestSchema.parse(manifest);
  const manifestFile = path.join(projectRoot, ...syncManifestPath);

  await fs.mkdir(path.dirname(manifestFile), { recursive: true });
  await fs.writeFile(
    manifestFile,
    `${JSON.stringify(parsed, null, 2)}\n`,
    'utf8',
  );

  return manifestFile;
}
