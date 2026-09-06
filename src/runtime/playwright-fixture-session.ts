import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';

import type { FixtureSession, FixtureTarget } from './fixture-session.js';
import { FIXTURE_INDEX_HTML, generateFixtureRenderModule } from './fixture-render-module.js';
import { launchPlaywrightPage } from './playwright-loader.js';
import { readDomSnapshot } from './read-dom-snapshot.js';
import { loadVite } from './vite-loader.js';

const RENDER_MODULE_ID = '\0archsync-fixture-render';

export async function createPlaywrightFixtureSession(input: {
  projectRoot: string;
  target: FixtureTarget;
}): Promise<{ session: FixtureSession; close: () => Promise<void>; origin: string }> {
  const projectRoot = path.resolve(input.projectRoot);
  const previousCwd = process.cwd();
  process.chdir(projectRoot);

  try {
    return await startFixtureSession({ projectRoot, previousCwd, target: input.target });
  } catch (error) {
    process.chdir(previousCwd);
    throw error;
  }
}

async function startFixtureSession(input: {
  projectRoot: string;
  previousCwd: string;
  target: FixtureTarget;
}): Promise<{ session: FixtureSession; close: () => Promise<void>; origin: string }> {
  const { projectRoot, previousCwd, target } = input;
  const viteApi = await loadVite(projectRoot);
  const renderModule = generateFixtureRenderModule(target);

  const vite = await viteApi.createServer({
    configFile: path.join(projectRoot, 'vite.config.ts'),
    root: projectRoot,
    mode: 'fixture',
    appType: 'custom',
    server: {
      middlewareMode: true,
      hmr: false,
    },
    plugins: [
      {
        name: 'archsync-fixture',
        resolveId(id: string) {
          if (id === '/__archsync/render.tsx') {
            return RENDER_MODULE_ID;
          }

          return undefined;
        },
        load(id: string) {
          if (id === RENDER_MODULE_ID) {
            return renderModule;
          }

          return undefined;
        },
      },
    ],
  });

  const httpServer = createServer((req, res) => {
    const url = req.url ?? '/';

    if (url.split('?')[0] === '/__archsync/fixture') {
      void vite
        .transformIndexHtml(url, FIXTURE_INDEX_HTML)
        .then((html) => {
          res.statusCode = 200;
          res.setHeader('content-type', 'text/html; charset=utf-8');
          res.end(html);
        })
        .catch((error: unknown) => {
          res.statusCode = 500;
          res.end(error instanceof Error ? error.message : String(error));
        });
      return;
    }

    vite.middlewares(req, res);
  });

  await new Promise<void>((resolve) => {
    httpServer.listen(0, '127.0.0.1', resolve);
  });

  const origin = `http://127.0.0.1:${(httpServer.address() as AddressInfo).port}`;
  const launched = await launchPlaywrightPage({ projectRoot });

  const session: FixtureSession = {
    async render({ props }) {
      const url = new URL('/__archsync/fixture', origin);
      url.searchParams.set('props', JSON.stringify(props));

      try {
        await launched.page.goto(url.toString(), {
          waitUntil: 'domcontentloaded',
          timeout: 20_000,
        });
        await launched.page.waitForSelector('#root button, #root [data-archsync-host]', {
          timeout: 15_000,
        });
      } catch {
        return undefined;
      }

      return readDomSnapshot(launched.page, '#root');
    },
  };

  return {
    session,
    origin,
    close: async () => {
      await launched.close();
      await vite.close();
      await new Promise<void>((resolve, reject) => {
        httpServer.close((error) => (error ? reject(error) : resolve()));
      });
      process.chdir(previousCwd);
    },
  };
}
