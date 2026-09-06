import type { AppSession } from './app-session.js';
import { launchPlaywrightPage } from './playwright-loader.js';
import { readDomSnapshot } from './read-dom-snapshot.js';

export async function createPlaywrightAppSession(input: {
  projectRoot: string;
  appUrl: string;
}): Promise<{ session: AppSession; close: () => Promise<void> }> {
  const launched = await launchPlaywrightPage({
    projectRoot: input.projectRoot,
    ignoreHTTPSErrors: true,
  });
  const baseUrl = input.appUrl.replace(/\/$/, '');

  const session: AppSession = {
    async open(target) {
      const url = new URL(target.route, `${baseUrl}/`);

      try {
        await launched.page.goto(url.toString(), { waitUntil: 'networkidle', timeout: 15_000 });
        await launched.page.waitForSelector(target.selector, { timeout: 10_000 });
      } catch {
        return undefined;
      }

      return readDomSnapshot(launched.page, target.selector);
    },
  };

  return {
    session,
    close: launched.close,
  };
}
