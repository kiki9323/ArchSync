import { describe, expect, it } from 'vitest';

import { createAppObserver } from '../src/runtime/app-observer.js';
import type { AppSession, AppTarget } from '../src/runtime/app-session.js';
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
  sources: ['button.tsx'],
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
  ],
};

const target: AppTarget = {
  route: '/quest',
  selector: 'button',
};

function appSessionFrom(
  snapshot:
    | { html: string; attributes?: Record<string, boolean> }
    | undefined
    | (() => { html: string; attributes?: Record<string, boolean> } | undefined),
): AppSession {
  return {
    async open() {
      return typeof snapshot === 'function' ? snapshot() : snapshot;
    },
  };
}

describe('App Harness v0.1', () => {
  it('disabled=true가 렌더된 페이지는 attribute pass다', async () => {
    const expectations = toRuntimeExpectations(knowledge);
    const produced = await produceObservations({
      knowledge,
      expectations,
      observer: createAppObserver(
        appSessionFrom({
          html: '<button type="button" disabled>Claimed</button>',
          attributes: { disabled: true },
        }),
        target,
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

  it('disabled가 없으면 attribute fail이다', async () => {
    const expectations = toRuntimeExpectations(knowledge);
    const produced = await produceObservations({
      knowledge,
      expectations,
      observer: createAppObserver(
        appSessionFrom({
          html: '<button type="button">Claimed</button>',
          attributes: { disabled: false },
        }),
        target,
      ),
    });

    expect(compareRuntime(expectations, produced.observations)).toContainEqual({
      prop: 'disabled',
      kind: 'attribute',
      status: 'fail',
    });
  });

  it('conditional-render는 App v0.1에서 활성화하지 않는다', async () => {
    const expectations = toRuntimeExpectations(knowledge);
    const produced = await produceObservations({
      knowledge,
      expectations,
      observer: createAppObserver(
        appSessionFrom({
          html: '<button type="button" disabled>Claimed</button>',
          attributes: { disabled: true },
        }),
        target,
      ),
    });

    expect(produced.skipped).toContainEqual({
      prop: 'isLoading',
      reason: 'cannot-activate-prop',
    });
    expect(compareRuntime(expectations, produced.observations)).toContainEqual({
      prop: 'isLoading',
      kind: 'conditional-render',
      status: 'missing',
    });
  });

  it('DOM root를 못 찾으면 target-not-found다', async () => {
    const expectations = toRuntimeExpectations(knowledge);
    const produced = await produceObservations({
      knowledge,
      expectations,
      observer: createAppObserver(appSessionFrom(undefined), target),
    });

    expect(produced.skipped).toContainEqual({
      prop: 'disabled',
      reason: 'target-not-found',
    });
    expect(compareRuntime(expectations, produced.observations)).toContainEqual({
      prop: 'disabled',
      kind: 'attribute',
      status: 'missing',
    });
  });

  it('앱이 꺼져 있으면 app-unreachable로 남긴다', () => {
    const expectations = toRuntimeExpectations(knowledge);
    const produced = skipAllExpectations(expectations, 'app-unreachable');

    expect(produced.observations).toEqual([]);
    expect(produced.skipped).toContainEqual({ prop: 'disabled', reason: 'app-unreachable' });
    expect(compareRuntime(expectations, produced.observations)).toContainEqual({
      prop: 'disabled',
      kind: 'attribute',
      status: 'missing',
    });
  });

  it('App observer는 Knowledge를 해석하지 않고 expected attribute만 본다', async () => {
    let opened = 0;
    const session: AppSession = {
      async open(openedTarget) {
        opened += 1;
        expect(openedTarget).toEqual(target);
        return {
          html: '<button disabled>Claimed</button>',
          attributes: { disabled: true, hidden: true },
        };
      },
    };

    const expectations = toRuntimeExpectations(knowledge);
    const produced = await produceObservations({
      knowledge,
      expectations,
      observer: createAppObserver(session, target),
    });

    expect(opened).toBe(1);
    expect(produced.observations).toEqual([
      {
        prop: 'disabled',
        kind: 'attribute',
        attributes: { disabled: true },
      },
    ]);
  });
});

describe('Storybook and App share Browser Tool observation', () => {
  it('같은 snapshot이면 observation/compare 포맷이 같다', async () => {
    const snapshot = {
      html: '<button disabled>Claimed</button>',
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

    const [storybook, app] = await Promise.all([
      produceObservations({
        knowledge: attributeKnowledge,
        expectations,
        observer: createStorybookObserver(storybookSession),
      }),
      produceObservations({
        knowledge: attributeKnowledge,
        expectations,
        observer: createAppObserver(appSessionFrom(snapshot), target),
      }),
    ]);

    expect(storybook.observations).toEqual(app.observations);
    expect(compareRuntime(expectations, storybook.observations)).toEqual(
      compareRuntime(expectations, app.observations),
    );
    expect(compareRuntime(expectations, app.observations)).toEqual([
      { prop: 'disabled', kind: 'attribute', status: 'pass' },
    ]);
  });
});
