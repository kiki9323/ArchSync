import { launchPlaywrightPage } from './playwright-loader.js';
import { readDomSnapshot } from './read-dom-snapshot.js';
import type { StorybookSession, StorybookStory } from './storybook-session.js';

export async function createPlaywrightStorybookSession(input: {
  projectRoot: string;
  storybookUrl: string;
}): Promise<{ session: StorybookSession; close: () => Promise<void> }> {
  const launched = await launchPlaywrightPage({ projectRoot: input.projectRoot });
  const baseUrl = input.storybookUrl.replace(/\/$/, '');

  const session: StorybookSession = {
    async listStories() {
      const response = await fetch(`${baseUrl}/index.json`);

      if (!response.ok) {
        return [];
      }

      return parseStories(await response.json());
    },

    async openStory({ storyId, args }) {
      const url = new URL('iframe.html', `${baseUrl}/`);
      url.searchParams.set('id', storyId);
      url.searchParams.set('viewMode', 'story');

      if (args && Object.keys(args).length > 0) {
        url.searchParams.set(
          'args',
          Object.entries(args)
            .map(([name, value]) =>
              value === 'true' ? `${name}:!true` : `${name}:${value}`,
            )
            .join(';'),
        );
      }

      await launched.page.goto(url.toString(), { waitUntil: 'networkidle', timeout: 15_000 });
      await launched.page.waitForSelector('#storybook-root', { timeout: 10_000 });

      return readDomSnapshot(launched.page, '#storybook-root');
    },
  };

  return {
    session,
    close: launched.close,
  };
}

function parseStories(index: unknown): StorybookStory[] {
  if (!index || typeof index !== 'object') {
    return [];
  }

  const record = index as { entries?: Record<string, unknown>; stories?: Record<string, unknown> };
  const entries = record.entries ?? record.stories ?? {};

  return Object.values(entries).flatMap((entry) => {
    if (!entry || typeof entry !== 'object') {
      return [];
    }

    const item = entry as { id?: string; title?: string; name?: string; type?: string };

    if (item.type && item.type !== 'story') {
      return [];
    }

    if (!item.id || !item.title || !item.name) {
      return [];
    }

    return [{ id: item.id, title: item.title, name: item.name }];
  });
}
