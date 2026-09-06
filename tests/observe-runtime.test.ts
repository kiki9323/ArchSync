import { describe, expect, it } from 'vitest';

import { produceObservations, skipAllExpectations } from '../src/runtime/produce-observations.js';
import { createStorybookObserver } from '../src/runtime/storybook-observer.js';
import type { StorybookSession } from '../src/runtime/storybook-session.js';
import { compareRuntime } from '../src/validator/compare-runtime.js';
import { toRuntimeExpectations } from '../src/validator/to-runtime-expectations.js';
import type { ComponentKnowledge } from '../src/schema/component-knowledge.js';

const knowledge: ComponentKnowledge = {
  component: 'Chip',
  nativeProps: [],
  sources: ['chip.tsx'],
  props: [
    {
      name: 'open',
      type: 'boolean | undefined',
      optional: true,
      behavior: [
        {
          kind: 'conditional-render',
          evidence: 'open ? <Panel /> : null',
        },
      ],
    },
    {
      name: 'error',
      type: 'boolean | undefined',
      optional: true,
      behavior: [
        {
          kind: 'conditional-logic',
          evidence: 'error && retry',
        },
      ],
    },
    {
      name: 'icon',
      type: 'import("react").ReactNode',
      optional: true,
      behavior: [
        {
          kind: 'conditional-render',
          evidence: 'icon && <Icon />',
        },
      ],
    },
  ],
};

function sessionFrom(input: {
  stories?: Awaited<ReturnType<StorybookSession['listStories']>>;
  htmlFor?: (args: Record<string, string>) =>
    | { html: string; attributes?: Record<string, boolean> }
    | string
    | undefined;
}): StorybookSession {
  return {
    async listStories() {
      return (
        input.stories ?? [{ id: 'components-chip--default', title: 'Components/Chip', name: 'Default' }]
      );
    },
    async openStory({ args }) {
      const result = input.htmlFor?.(args ?? {});

      if (result === undefined) {
        return undefined;
      }

      return typeof result === 'string' ? { html: result } : result;
    },
  };
}

async function run(observerSession: StorybookSession) {
  const expectations = toRuntimeExpectations(knowledge);
  const produced = await produceObservations({
    knowledge,
    expectations,
    observer: createStorybookObserver(observerSession),
  });

  return {
    expectations,
    ...produced,
    comparison: compareRuntime(expectations, produced.observations),
  };
}

describe('Storybook Browser Tool', () => {
  it('prop 변경으로 DOM이 달라지는 경우 → pass', async () => {
    const result = await run(
      sessionFrom({
        htmlFor: (args) =>
          args.open === 'true' ? '<div data-open="true">panel</div>' : '<div>idle</div>',
      }),
    );

    expect(result.expectations.map((item) => item.prop)).toEqual(['open', 'icon']);
    expect(result.observations).toContainEqual({
      prop: 'open',
      kind: 'conditional-render',
      renderChanged: true,
    });
    expect(result.comparison).toContainEqual({
      prop: 'open',
      kind: 'conditional-render',
      status: 'pass',
    });
  });

  it('prop을 바꿔도 DOM이 동일한 경우 → fail', async () => {
    const result = await run(
      sessionFrom({
        htmlFor: () => '<div>idle</div>',
      }),
    );

    expect(result.observations).toContainEqual({
      prop: 'open',
      kind: 'conditional-render',
      renderChanged: false,
    });
    expect(result.comparison).toContainEqual({
      prop: 'open',
      kind: 'conditional-render',
      status: 'fail',
    });
  });

  it('Story 또는 관측값을 만들 수 없는 경우 → missing + skip reason', async () => {
    const noStory = await run(sessionFrom({ stories: [], htmlFor: () => '<div>idle</div>' }));
    const noSnapshot = await run(sessionFrom({ htmlFor: () => undefined }));

    expect(noStory.skipped).toContainEqual({ prop: 'open', reason: 'no-story' });
    expect(noStory.comparison).toContainEqual({
      prop: 'open',
      kind: 'conditional-render',
      status: 'missing',
    });
    expect(noSnapshot.skipped).toContainEqual({ prop: 'open', reason: 'snapshot-unavailable' });
    expect(noSnapshot.skipped).toContainEqual({ prop: 'icon', reason: 'cannot-activate-prop' });
  });

  it('Storybook이 꺼져 있으면 storybook-unreachable로 남긴다', () => {
    const expectations = toRuntimeExpectations(knowledge);
    const produced = skipAllExpectations(expectations, 'storybook-unreachable');

    expect(produced.observations).toEqual([]);
    expect(produced.skipped).toEqual([
      { prop: 'open', reason: 'storybook-unreachable' },
      { prop: 'icon', reason: 'storybook-unreachable' },
    ]);
    expect(compareRuntime(expectations, produced.observations)).toEqual([
      { prop: 'open', kind: 'conditional-render', status: 'missing' },
      { prop: 'icon', kind: 'conditional-render', status: 'missing' },
    ]);
  });

  it('conditional-logic은 browser 대상에서 제외된다', async () => {
    const result = await run(
      sessionFrom({
        htmlFor: (args) =>
          args.open === 'true' ? '<div data-open="true">panel</div>' : '<div>idle</div>',
      }),
    );

    expect(result.expectations.some((item) => item.prop === 'error')).toBe(false);
    expect(result.observations.some((item) => item.prop === 'error')).toBe(false);
    expect(result.comparison.some((item) => item.prop === 'error')).toBe(false);
  });

  it('HTML boolean attribute는 expected에 지정된 attribute만 관측한다', async () => {
    const withDisabled: ComponentKnowledge = {
      ...knowledge,
      nativeAttributes: [{ prop: 'disabled', attribute: 'disabled' }],
    };

    const expectations = toRuntimeExpectations(withDisabled);
    const produced = await produceObservations({
      knowledge: withDisabled,
      expectations,
      observer: createStorybookObserver(
        sessionFrom({
          htmlFor: (args) => ({
            html: args.disabled === 'true' ? '<button disabled></button>' : '<button></button>',
            attributes: { disabled: args.disabled === 'true' },
          }),
        }),
      ),
    });

    expect(expectations).toContainEqual({
      prop: 'disabled',
      kind: 'attribute',
      attribute: 'disabled',
      value: true,
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

  it('disabled가 렌더되지 않으면 attribute comparison은 fail이다', async () => {
    const withDisabled: ComponentKnowledge = {
      ...knowledge,
      nativeAttributes: [{ prop: 'disabled', attribute: 'disabled' }],
    };
    const expectations = toRuntimeExpectations(withDisabled);
    const produced = await produceObservations({
      knowledge: withDisabled,
      expectations,
      observer: createStorybookObserver(
        sessionFrom({
          htmlFor: () => ({
            html: '<button></button>',
            attributes: { disabled: false },
          }),
        }),
      ),
    });

    expect(compareRuntime(expectations, produced.observations)).toContainEqual({
      prop: 'disabled',
      kind: 'attribute',
      status: 'fail',
    });
  });

  it('isLoading 같은 custom boolean은 attribute로 관측하지 않는다', async () => {
    const withLoading: ComponentKnowledge = {
      ...knowledge,
      props: [
        ...knowledge.props,
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

    const expectations = toRuntimeExpectations(withLoading);

    expect(expectations.some((item) => item.prop === 'isLoading' && item.kind === 'attribute')).toBe(
      false,
    );
    expect(expectations).toContainEqual({
      prop: 'isLoading',
      kind: 'conditional-render',
      evidence: 'isLoading ? <Spinner /> : children',
    });
  });

  it('readOnly는 DOM attribute 이름 readonly로 관측한다', async () => {
    const withReadOnly: ComponentKnowledge = {
      ...knowledge,
      nativeAttributes: [{ prop: 'readOnly', attribute: 'readonly' }],
    };
    const expectations = toRuntimeExpectations(withReadOnly);
    const produced = await produceObservations({
      knowledge: withReadOnly,
      expectations,
      observer: createStorybookObserver(
        sessionFrom({
          htmlFor: (args) => ({
            html: args.readOnly === 'true' ? '<input readonly>' : '<input>',
            attributes: { readonly: args.readOnly === 'true' },
          }),
        }),
      ),
    });

    expect(expectations).toContainEqual({
      prop: 'readOnly',
      kind: 'attribute',
      attribute: 'readonly',
      value: true,
    });
    expect(produced.observations).toContainEqual({
      prop: 'readOnly',
      kind: 'attribute',
      attributes: { readonly: true },
    });
    expect(compareRuntime(expectations, produced.observations)).toContainEqual({
      prop: 'readOnly',
      kind: 'attribute',
      status: 'pass',
    });
  });
});
