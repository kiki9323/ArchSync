import { describe, expect, it } from 'vitest';

import { createFixtureObserver } from '../src/runtime/fixture-observer.js';
import type { FixtureSession } from '../src/runtime/fixture-session.js';
import { produceObservations, skipAllExpectations } from '../src/runtime/produce-observations.js';
import { createStorybookObserver } from '../src/runtime/storybook-observer.js';
import type { StorybookSession } from '../src/runtime/storybook-session.js';
import { compareRuntime } from '../src/validator/compare-runtime.js';
import { toRuntimeExpectations } from '../src/validator/to-runtime-expectations.js';
import type { ComponentKnowledge } from '../src/schema/component-knowledge.js';

const knowledge: ComponentKnowledge = {
  component: 'Button',
  nativeProps: [{ source: 'React.ButtonHTMLAttributes<HTMLButtonElement>' }],
  nativeAttributes: [{ prop: 'disabled', attribute: 'disabled' }],
  sources: ['src/components/ui/button/button.tsx'],
  props: [
    {
      name: 'isLoading',
      type: 'boolean | undefined',
      optional: true,
      behavior: [
        {
          kind: 'conditional-render',
          evidence: 'isLoading ? <Spinner /> : children',
        },
      ],
    },
    {
      name: 'startIcon',
      type: 'import("react").ReactNode',
      optional: true,
      behavior: [
        {
          kind: 'conditional-render',
          evidence: 'startIcon && <Icon />',
        },
      ],
    },
  ],
};

function fixtureSessionFrom(
  snapshotFor: (props: Record<string, unknown>) =>
    | { html: string; attributes?: Record<string, boolean> }
    | undefined,
): FixtureSession {
  return {
    async render({ props }) {
      return snapshotFor(props);
    },
  };
}

describe('Fixture Harness v0.1', () => {
  it('disabled=true를 주입해 렌더되면 pass다', async () => {
    const expectations = toRuntimeExpectations(knowledge);
    const produced = await produceObservations({
      knowledge,
      expectations,
      observer: createFixtureObserver(
        fixtureSessionFrom((props) => {
          expect(props).toEqual({ disabled: true });
          return {
            html: '<button type="button" disabled>Fixture</button>',
            attributes: { disabled: true },
          };
        }),
      ),
    });

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
  });

  it('expected와 렌더 결과가 다르면 fail이다', async () => {
    const expectations = toRuntimeExpectations(knowledge);
    const produced = await produceObservations({
      knowledge,
      expectations,
      observer: createFixtureObserver(
        fixtureSessionFrom(() => ({
          html: '<button type="button">Fixture</button>',
          attributes: { disabled: false },
        })),
      ),
    });

    expect(compareRuntime(expectations, produced.observations)).toContainEqual({
      prop: 'disabled',
      kind: 'attribute',
      status: 'fail',
    });
  });

  it('자동 생성할 수 없는 prop은 missing + reason이다', async () => {
    const expectations = toRuntimeExpectations(knowledge);
    const produced = await produceObservations({
      knowledge,
      expectations,
      observer: createFixtureObserver(
        fixtureSessionFrom(() => ({
          html: '<button disabled>Fixture</button>',
          attributes: { disabled: true },
        })),
      ),
    });

    expect(produced.skipped).toContainEqual({
      prop: 'startIcon',
      reason: 'cannot-activate-prop',
    });
    expect(produced.skipped).toContainEqual({
      prop: 'isLoading',
      reason: 'cannot-activate-prop',
    });
    expect(compareRuntime(expectations, produced.observations)).toContainEqual({
      prop: 'startIcon',
      kind: 'conditional-render',
      status: 'missing',
    });
  });

  it('fixture 환경을 못 띄우면 fixture-unreachable이다', () => {
    const expectations = toRuntimeExpectations(knowledge);
    const produced = skipAllExpectations(expectations, 'fixture-unreachable');

    expect(produced.skipped).toContainEqual({
      prop: 'disabled',
      reason: 'fixture-unreachable',
    });
  });
});

describe('Storybook and Fixture share Browser Tool observation', () => {
  it('같은 snapshot이면 observation/compare 포맷이 같다', async () => {
    const snapshot = {
      html: '<button disabled>Fixture</button>',
      attributes: { disabled: true },
    };
    const attributeKnowledge: ComponentKnowledge = {
      component: 'Button',
      nativeProps: [],
      nativeAttributes: [{ prop: 'disabled', attribute: 'disabled' }],
      sources: ['button.tsx'],
      props: [],
    };
    const expectations = toRuntimeExpectations(attributeKnowledge);

    const storybookSession: StorybookSession = {
      async listStories() {
        return [{ id: 'button--default', title: 'Components/Button', name: 'Default' }];
      },
      async openStory() {
        return snapshot;
      },
    };

    const [storybook, fixture] = await Promise.all([
      produceObservations({
        knowledge: attributeKnowledge,
        expectations,
        observer: createStorybookObserver(storybookSession),
      }),
      produceObservations({
        knowledge: attributeKnowledge,
        expectations,
        observer: createFixtureObserver(fixtureSessionFrom(() => snapshot)),
      }),
    ]);

    expect(fixture.observations).toEqual(storybook.observations);
    expect(compareRuntime(expectations, fixture.observations)).toEqual(
      compareRuntime(expectations, storybook.observations),
    );
    expect(compareRuntime(expectations, fixture.observations)).toEqual([
      { prop: 'disabled', kind: 'attribute', status: 'pass' },
    ]);
  });
});
