import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { extractComponent } from '../src/extractor/component.js';
import { createComponentKnowledge } from '../src/knowledge/create-component-knowledge.js';
import { createFixtureObserver } from '../src/runtime/fixture-observer.js';
import { createPlaywrightFixtureSession } from '../src/runtime/playwright-fixture-session.js';
import { produceObservations } from '../src/runtime/produce-observations.js';
import { resolveFixtureTarget } from '../src/runtime/resolve-fixture-target.js';
import { compareRuntime } from '../src/validator/compare-runtime.js';
import { toRuntimeExpectations } from '../src/validator/to-runtime-expectations.js';

describe('Fixture Harness Playwright', () => {
  it(
    'deeps-www Button을 실제로 import해 disabled=true를 닫힌 루프로 관측한다',
    async () => {
      const projectRoot = path.resolve('../deeps-www');
      const raw = extractComponent({
        projectRoot,
        file: 'src/components/ui/button/button.tsx',
        propsInterfaceName: 'ButtonProps',
      });
      const knowledge = createComponentKnowledge(raw);
      const expectations = toRuntimeExpectations(knowledge);
      const target = resolveFixtureTarget({
        component: knowledge.component,
        sources: knowledge.sources,
      });

      const fixture = await createPlaywrightFixtureSession({ projectRoot, target });

      try {
        const produced = await produceObservations({
          knowledge,
          expectations,
          observer: createFixtureObserver(fixture.session),
        });

        expect(target.modulePath).toBe('src/components/ui/button/button.tsx');
        expect(produced.observations).toContainEqual({
          prop: 'disabled',
          kind: 'attribute',
          attributes: { disabled: true },
        });
        expect(compareRuntime(expectations, produced.observations)).toContainEqual({
          prop: 'disabled',
          kind: 'attribute',
          status: 'pass',
        });
        expect(produced.skipped).toContainEqual({
          prop: 'startIcon',
          reason: 'cannot-activate-prop',
        });
      } finally {
        await fixture.close();
      }
    },
    60_000,
  );
});
