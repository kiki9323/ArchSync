import { createServer } from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { AddressInfo } from 'node:net';

import { describe, expect, it } from 'vitest';

import { createAppObserver } from '../src/runtime/app-observer.js';
import { createPlaywrightAppSession } from '../src/runtime/playwright-app-session.js';
import { produceObservations } from '../src/runtime/produce-observations.js';
import { compareRuntime } from '../src/validator/compare-runtime.js';
import { toRuntimeExpectations } from '../src/validator/to-runtime-expectations.js';
import type { ComponentKnowledge } from '../src/schema/component-knowledge.js';

const knowledge: ComponentKnowledge = {
  component: 'Button',
  nativeProps: [{ source: 'React.ButtonHTMLAttributes<HTMLButtonElement>' }],
  nativeAttributes: [{ prop: 'disabled', attribute: 'disabled' }],
  sources: ['src/components/ui/button/button.tsx'],
  props: [],
};

async function serveClaimedPage(): Promise<{ url: string; close: () => Promise<void> }> {
  const html = await fs.readFile(path.resolve('fixtures/app-page/claimed.html'), 'utf8');
  const server = createServer((request, response) => {
    if (request.url === '/quest' || request.url === '/quest/') {
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      response.end(html);
      return;
    }

    response.writeHead(404);
    response.end();
  });

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });

  const address = server.address() as AddressInfo;

  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}

describe('App Harness Playwright', () => {
  it('claimed 페이지의 Button disabled를 닫힌 루프로 관측한다', async () => {
    const page = await serveClaimedPage();
    let closeSession: (() => Promise<void>) | undefined;

    try {
      const playwrightSession = await createPlaywrightAppSession({
        projectRoot: path.resolve('.'),
        appUrl: page.url,
      });
      closeSession = playwrightSession.close;

      const expectations = toRuntimeExpectations(knowledge);
      const produced = await produceObservations({
        knowledge,
        expectations,
        observer: createAppObserver(playwrightSession.session, {
          route: '/quest',
          selector: 'button',
        }),
      });

      expect(produced.observations).toEqual([
        {
          prop: 'disabled',
          kind: 'attribute',
          attributes: { disabled: true },
        },
      ]);
      expect(compareRuntime(expectations, produced.observations)).toEqual([
        { prop: 'disabled', kind: 'attribute', status: 'pass' },
      ]);
    } finally {
      await closeSession?.();
      await page.close();
    }
  });
});
