import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export interface PlaywrightPage {
  goto: (url: string, options?: { waitUntil?: string; timeout?: number }) => Promise<unknown>;
  waitForSelector: (selector: string, options?: { timeout?: number }) => Promise<unknown>;
  locator: (selector: string) => { innerHTML: () => Promise<string> };
  evaluate: {
    <T>(fn: () => T): Promise<T>;
    <T, A>(fn: (arg: A) => T, arg: A): Promise<T>;
  };
}

interface PlaywrightBrowser {
  newPage: () => Promise<PlaywrightPage>;
  newContext: (options?: { ignoreHTTPSErrors?: boolean }) => Promise<{
    newPage: () => Promise<PlaywrightPage>;
  }>;
  close: () => Promise<void>;
}

interface PlaywrightModule {
  chromium: {
    launch: (options?: { headless?: boolean }) => Promise<PlaywrightBrowser>;
  };
  default?: PlaywrightModule;
}

export async function launchPlaywrightPage(input: {
  projectRoot: string;
  ignoreHTTPSErrors?: boolean;
}): Promise<{ page: PlaywrightPage; close: () => Promise<void> }> {
  const playwright = await loadPlaywright(input.projectRoot);
  const browser = await playwright.chromium.launch({ headless: true });
  const context = await browser.newContext({ ignoreHTTPSErrors: input.ignoreHTTPSErrors ?? true });
  const page = await context.newPage();

  return {
    page,
    close: async () => {
      await browser.close();
    },
  };
}

async function loadPlaywright(projectRoot: string): Promise<PlaywrightModule> {
  const fromArchSync = tryRequirePlaywright(fileURLToPath(new URL('../../package.json', import.meta.url)));
  const fromTarget = tryRequirePlaywright(path.join(projectRoot, 'package.json'));
  const loaded = fromArchSync ?? fromTarget;

  if (!loaded) {
    throw new Error(
      'Playwright not found. Install it in ArchSync (optional runtime) or the target project.',
    );
  }

  return loaded.chromium ? loaded : loaded.default ?? loaded;
}

function tryRequirePlaywright(
  fromPackageJson: string,
): (PlaywrightModule & { default?: PlaywrightModule }) | undefined {
  try {
    const require = createRequire(fromPackageJson);

    return require('playwright') as PlaywrightModule & { default?: PlaywrightModule };
  } catch {
    return undefined;
  }
}
