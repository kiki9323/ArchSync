import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export interface ViteDevServer {
  middlewares: (req: unknown, res: unknown, next?: unknown) => void;
  transformIndexHtml: (url: string, html: string) => Promise<string>;
  close: () => Promise<void>;
}

interface ViteModule {
  createServer: (inline?: Record<string, unknown>) => Promise<ViteDevServer>;
}

export async function loadVite(projectRoot: string): Promise<ViteModule> {
  const require = createRequire(path.join(projectRoot, 'package.json'));

  try {
    const vitePath = require.resolve('vite');
    const loaded = (await import(pathToFileURL(vitePath).href)) as ViteModule & {
      default?: ViteModule;
    };

    return loaded.default ?? loaded;
  } catch {
    throw new Error(
      'Vite not found in the target project. Fixture harness needs the target Vite toolchain.',
    );
  }
}
