import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Content fingerprint. mtime이 아니라 파일 내용 기반이다.
 */
export async function hashFileContents(
  projectRoot: string,
  relativePaths: string[],
): Promise<Map<string, string>> {
  const hashes = new Map<string, string>();

  for (const relativePath of [...relativePaths].sort(compareText)) {
    const absolutePath = path.join(projectRoot, relativePath);

    try {
      const content = await fs.readFile(absolutePath);
      hashes.set(relativePath, createHash('sha256').update(content).digest('hex'));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        hashes.set(relativePath, 'missing');
        continue;
      }

      throw error;
    }
  }

  return hashes;
}

export function createComponentFingerprint(input: {
  modulePath: string;
  exportName: string;
  propsInterfaceName?: string;
  dependencies: Map<string, string>;
  aliases: string[];
}): string {
  const payload = {
    extractorVersion: 3,
    modulePath: input.modulePath,
    exportName: input.exportName,
    propsInterfaceName: input.propsInterfaceName ?? null,
    aliases: [...input.aliases].sort(compareText),
    files: [...input.dependencies.entries()].sort(([left], [right]) =>
      compareText(left, right),
    ),
  };

  return createHash('sha256')
    .update(JSON.stringify(payload))
    .digest('hex');
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
