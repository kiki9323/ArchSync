import path from 'node:path';

import { readComponentKnowledge } from './knowledge/read-component-knowledge.js';
import { createAppObserver } from './runtime/app-observer.js';
import type { AppTarget } from './runtime/app-session.js';
import { createFixtureObserver } from './runtime/fixture-observer.js';
import { produceObservations, skipAllExpectations } from './runtime/produce-observations.js';
import { createPlaywrightAppSession } from './runtime/playwright-app-session.js';
import { createPlaywrightFixtureSession } from './runtime/playwright-fixture-session.js';
import { createPlaywrightStorybookSession } from './runtime/playwright-storybook-session.js';
import { probeApp } from './runtime/probe-app.js';
import { probeStorybook } from './runtime/probe-storybook.js';
import { resolveFixtureTarget } from './runtime/resolve-fixture-target.js';
import { createStorybookObserver } from './runtime/storybook-observer.js';
import type { ComponentKnowledge } from './schema/component-knowledge.js';
import { compareRuntime } from './validator/compare-runtime.js';
import { toRuntimeExpectations } from './validator/to-runtime-expectations.js';

function flag(name: string): string | undefined {
  const index = process.argv.indexOf(name);

  if (index === -1) {
    return undefined;
  }

  return process.argv[index + 1];
}

async function main() {
  const projectRoot = path.resolve(flag('--project') ?? '../deeps-www');
  const component = flag('--component') ?? 'Button';
  const harness = flag('--harness') ?? 'storybook';
  const knowledgeResult = await readComponentKnowledge(projectRoot, component);

  if (knowledgeResult.status === 'missing') {
    throw new Error(`Knowledge not found: ${knowledgeResult.path}`);
  }

  const knowledge = knowledgeResult.knowledge;
  const expectations = toRuntimeExpectations(knowledge);

  if (harness === 'app') {
    await runApp({ projectRoot, knowledge, expectations });
    return;
  }

  if (harness === 'fixture') {
    await runFixture({ projectRoot, knowledge, expectations });
    return;
  }

  if (harness !== 'storybook') {
    throw new Error(`Unknown harness: ${harness}. Use storybook, app, or fixture.`);
  }

  await runStorybook({ projectRoot, knowledge, expectations });
}

async function runStorybook(input: {
  projectRoot: string;
  knowledge: ComponentKnowledge;
  expectations: ReturnType<typeof toRuntimeExpectations>;
}) {
  const storybookUrl = flag('--storybook-url') ?? 'http://127.0.0.1:6006';
  const storybook = await probeStorybook(storybookUrl);

  let produced = skipAllExpectations(input.expectations, 'storybook-unreachable');
  let browserError: string | undefined;
  let close: (() => Promise<void>) | undefined;

  if (storybook.reachable) {
    try {
      const playwrightSession = await createPlaywrightStorybookSession({
        projectRoot: input.projectRoot,
        storybookUrl: storybook.url,
      });
      close = playwrightSession.close;
      produced = await produceObservations({
        knowledge: input.knowledge,
        expectations: input.expectations,
        observer: createStorybookObserver(playwrightSession.session),
      });
    } catch (error) {
      browserError = error instanceof Error ? error.message : String(error);
      produced = skipAllExpectations(input.expectations, 'browser-launch-failed');
    } finally {
      await close?.();
    }
  }

  printResult({
    component: input.knowledge.component,
    harness: 'storybook',
    storybook,
    browserError,
    expectations: input.expectations,
    observations: produced.observations,
    skipped: produced.skipped,
    comparison: compareRuntime(input.expectations, produced.observations),
  });

  if (!storybook.reachable || browserError) {
    process.exitCode = 1;
  }
}

async function runApp(input: {
  projectRoot: string;
  knowledge: ComponentKnowledge;
  expectations: ReturnType<typeof toRuntimeExpectations>;
}) {
  const appUrl = flag('--app-url') ?? 'https://local.boradeeps.net:3000';
  const route = flag('--route');
  const selector = flag('--selector');

  if (!route || !selector) {
    throw new Error('App harness requires --route and --selector.');
  }

  const target: AppTarget = { route, selector };
  const app = await probeApp(new URL(route, `${appUrl.replace(/\/$/, '')}/`).toString());

  let produced = skipAllExpectations(input.expectations, 'app-unreachable');
  let browserError: string | undefined;
  let close: (() => Promise<void>) | undefined;

  if (app.reachable) {
    try {
      const playwrightSession = await createPlaywrightAppSession({
        projectRoot: input.projectRoot,
        appUrl,
      });
      close = playwrightSession.close;
      produced = await produceObservations({
        knowledge: input.knowledge,
        expectations: input.expectations,
        observer: createAppObserver(playwrightSession.session, target),
      });
    } catch (error) {
      browserError = error instanceof Error ? error.message : String(error);
      produced = skipAllExpectations(input.expectations, 'browser-launch-failed');
    } finally {
      await close?.();
    }
  }

  printResult({
    component: input.knowledge.component,
    harness: 'app',
    target,
    app,
    browserError,
    expectations: input.expectations,
    observations: produced.observations,
    skipped: produced.skipped,
    comparison: compareRuntime(input.expectations, produced.observations),
  });

  if (!app.reachable || browserError) {
    process.exitCode = 1;
  }
}

async function runFixture(input: {
  projectRoot: string;
  knowledge: ComponentKnowledge;
  expectations: ReturnType<typeof toRuntimeExpectations>;
}) {
  const target = resolveFixtureTarget({
    component: input.knowledge.component,
    sources: input.knowledge.sources,
    modulePath: flag('--file'),
  });

  let produced = skipAllExpectations(input.expectations, 'fixture-unreachable');
  let browserError: string | undefined;
  let close: (() => Promise<void>) | undefined;
  let origin: string | undefined;

  try {
    const playwrightSession = await createPlaywrightFixtureSession({
      projectRoot: input.projectRoot,
      target,
    });
    close = playwrightSession.close;
    origin = playwrightSession.origin;
    produced = await produceObservations({
      knowledge: input.knowledge,
      expectations: input.expectations,
      observer: createFixtureObserver(playwrightSession.session),
    });
  } catch (error) {
    browserError = error instanceof Error ? error.message : String(error);
    produced = skipAllExpectations(
      input.expectations,
      browserError.includes('Playwright') ? 'browser-launch-failed' : 'fixture-unreachable',
    );
  } finally {
    await close?.();
  }

  printResult({
    component: input.knowledge.component,
    harness: 'fixture',
    target,
    fixture: origin ? { origin, reachable: true } : { reachable: false },
    browserError,
    expectations: input.expectations,
    observations: produced.observations,
    skipped: produced.skipped,
    comparison: compareRuntime(input.expectations, produced.observations),
  });

  if (browserError) {
    process.exitCode = 1;
  }
}

function printResult(result: unknown) {
  console.log(JSON.stringify(result, null, 2));
}

await main();
