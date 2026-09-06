import { createAppObserver } from '../runtime/app-observer.js';
import type { AppTarget } from '../runtime/app-session.js';
import { createFixtureObserver } from '../runtime/fixture-observer.js';
import { createPlaywrightAppSession } from '../runtime/playwright-app-session.js';
import { createPlaywrightFixtureSession } from '../runtime/playwright-fixture-session.js';
import { createPlaywrightStorybookSession } from '../runtime/playwright-storybook-session.js';
import { probeApp } from '../runtime/probe-app.js';
import { probeStorybook } from '../runtime/probe-storybook.js';
import {
  produceObservations,
  skipAllExpectations,
  type ProducedObservations,
} from '../runtime/produce-observations.js';
import { resolveFixtureTarget } from '../runtime/resolve-fixture-target.js';
import { createStorybookObserver } from '../runtime/storybook-observer.js';
import type { ComponentKnowledge } from '../schema/component-knowledge.js';
import {
  RuntimeValidationResultSchema,
  type RuntimeValidationResult,
  type ValidateHarness,
} from '../schema/component-validation.js';
import type { RuntimeExpectation } from '../schema/runtime.js';
import { compareRuntime } from './compare-runtime.js';
import { toRuntimeExpectations } from './to-runtime-expectations.js';

export interface RunRuntimeValidationInput {
  projectRoot: string;
  knowledge: ComponentKnowledge;
  knowledgePath: string;
  harness: ValidateHarness;
  file?: string;
  route?: string;
  selector?: string;
  storybookUrl?: string;
  appUrl?: string;
}

export interface RunRuntimeValidationDependencies {
  produce?: (input: {
    knowledge: ComponentKnowledge;
    expectations: RuntimeExpectation[];
  }) => Promise<ProducedObservations>;
}

/**
 * 기존 Runtime Expected / Harness / Browser Tool / Compare를 호출한다.
 * 새 expectation이나 pass/fail 규칙을 만들지 않는다.
 */
export async function runRuntimeValidation(
  input: RunRuntimeValidationInput,
  dependencies: RunRuntimeValidationDependencies = {},
): Promise<RuntimeValidationResult> {
  const expectations = toRuntimeExpectations(input.knowledge);
  const produced = dependencies.produce
    ? await dependencies.produce({
        knowledge: input.knowledge,
        expectations,
      })
    : await produceWithHarness(input, expectations);

  return serializeRuntimeValidation({
    component: input.knowledge.component,
    knowledgePath: input.knowledgePath,
    harness: input.harness,
    expectations,
    produced,
  });
}

export function serializeRuntimeValidation(input: {
  component: string;
  knowledgePath: string;
  harness: ValidateHarness;
  expectations: RuntimeExpectation[];
  produced: ProducedObservations;
}): RuntimeValidationResult {
  const comparisons = compareRuntime(
    input.expectations,
    input.produced.observations,
  );
  const passed = countComparison(comparisons, 'pass');
  const failed = countComparison(comparisons, 'fail');
  const unknown =
    countComparison(comparisons, 'missing') + input.produced.skipped.length;

  return RuntimeValidationResultSchema.parse({
    status: runtimeStatus({ passed, failed, unknown }),
    mode: 'runtime',
    harness: input.harness,
    component: input.component,
    knowledge: input.knowledgePath,
    summary: {
      checked: comparisons.length,
      passed,
      failed,
      unknown,
    },
    comparisons,
    skipped: input.produced.skipped,
  });
}

async function produceWithHarness(
  input: RunRuntimeValidationInput,
  expectations: RuntimeExpectation[],
): Promise<ProducedObservations> {
  if (input.harness === 'fixture') {
    return produceFixture(input, expectations);
  }

  if (input.harness === 'app') {
    return produceApp(input, expectations);
  }

  return produceStorybook(input, expectations);
}

async function produceFixture(
  input: RunRuntimeValidationInput,
  expectations: RuntimeExpectation[],
): Promise<ProducedObservations> {
  const target = resolveFixtureTarget({
    component: input.knowledge.component,
    sources: input.knowledge.sources,
    modulePath: input.file,
  });
  let close: (() => Promise<void>) | undefined;

  try {
    const playwrightSession = await createPlaywrightFixtureSession({
      projectRoot: input.projectRoot,
      target,
    });
    close = playwrightSession.close;

    return await produceObservations({
      knowledge: input.knowledge,
      expectations,
      observer: createFixtureObserver(playwrightSession.session),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    return skipAllExpectations(
      expectations,
      message.includes('Playwright')
        ? 'browser-launch-failed'
        : 'fixture-unreachable',
    );
  } finally {
    await close?.();
  }
}

async function produceStorybook(
  input: RunRuntimeValidationInput,
  expectations: RuntimeExpectation[],
): Promise<ProducedObservations> {
  const storybookUrl = input.storybookUrl ?? 'http://127.0.0.1:6006';
  const storybook = await probeStorybook(storybookUrl);

  if (!storybook.reachable) {
    return skipAllExpectations(expectations, 'storybook-unreachable');
  }

  let close: (() => Promise<void>) | undefined;

  try {
    const playwrightSession = await createPlaywrightStorybookSession({
      projectRoot: input.projectRoot,
      storybookUrl: storybook.url,
    });
    close = playwrightSession.close;

    return await produceObservations({
      knowledge: input.knowledge,
      expectations,
      observer: createStorybookObserver(playwrightSession.session),
    });
  } catch {
    return skipAllExpectations(expectations, 'browser-launch-failed');
  } finally {
    await close?.();
  }
}

async function produceApp(
  input: RunRuntimeValidationInput,
  expectations: RuntimeExpectation[],
): Promise<ProducedObservations> {
  if (!input.route || !input.selector) {
    throw new Error('App harness requires route and selector.');
  }

  const appUrl = input.appUrl ?? 'https://local.boradeeps.net:3000';
  const target: AppTarget = {
    route: input.route,
    selector: input.selector,
  };
  const app = await probeApp(
    new URL(input.route, `${appUrl.replace(/\/$/, '')}/`).toString(),
  );

  if (!app.reachable) {
    return skipAllExpectations(expectations, 'app-unreachable');
  }

  let close: (() => Promise<void>) | undefined;

  try {
    const playwrightSession = await createPlaywrightAppSession({
      projectRoot: input.projectRoot,
      appUrl,
    });
    close = playwrightSession.close;

    return await produceObservations({
      knowledge: input.knowledge,
      expectations,
      observer: createAppObserver(playwrightSession.session, target),
    });
  } catch {
    return skipAllExpectations(expectations, 'browser-launch-failed');
  } finally {
    await close?.();
  }
}

function runtimeStatus(input: {
  passed: number;
  failed: number;
  unknown: number;
}): RuntimeValidationResult['status'] {
  if (input.failed > 0) {
    return 'failed';
  }

  if (input.passed === 0 && input.unknown > 0) {
    return 'unknown';
  }

  return 'passed';
}

function countComparison(
  comparisons: Array<{ status: 'pass' | 'fail' | 'missing' }>,
  status: 'pass' | 'fail' | 'missing',
): number {
  return comparisons.filter((comparison) => comparison.status === status)
    .length;
}
