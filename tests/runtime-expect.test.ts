import { describe, expect, it } from 'vitest';

import { compareRuntime } from '../src/validator/compare-runtime.js';
import { toRuntimeExpectations } from '../src/validator/to-runtime-expectations.js';
import type { ComponentKnowledge } from '../src/schema/component-knowledge.js';

const knowledge: ComponentKnowledge = {
  component: 'Chip',
  nativeProps: [],
  sources: ['chip.tsx'],
  props: [
    {
      name: 'tone',
      type: 'string',
      optional: true,
      behavior: [
        {
          kind: 'conditional-logic',
          evidence: 'tone && compact',
        },
        {
          kind: 'conditional-render',
          evidence: 'tone && <Badge />',
        },
      ],
    },
    {
      name: 'label',
      type: 'string',
      optional: false,
    },
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
      name: 'fullWidth',
      type: 'boolean | undefined',
      optional: true,
    },
  ],
};

describe('toRuntimeExpectations', () => {
  it('native boolean HTML attributes만 attribute expected가 된다', () => {
    expect(
      toRuntimeExpectations({
        ...knowledge,
        nativeAttributes: [{ prop: 'disabled', attribute: 'disabled' }],
      }),
    ).toContainEqual({
      prop: 'disabled',
      kind: 'attribute',
      attribute: 'disabled',
      value: true,
    });
  });

  it('custom boolean은 attribute expected가 되지 않는다', () => {
    const expectations = toRuntimeExpectations(knowledge);

    expect(expectations).toContainEqual({
      prop: 'isLoading',
      kind: 'conditional-render',
      evidence: 'isLoading ? <Spinner /> : children',
    });
    expect(expectations.some((item) => item.kind === 'attribute')).toBe(false);
    expect(expectations.some((item) => item.prop === 'fullWidth')).toBe(false);
  });

  it('custom prop 이름이 HTML attribute와 같아도 nativeAttributes가 아니면 expected를 만들지 않는다', () => {
    expect(
      toRuntimeExpectations({
        ...knowledge,
        props: [...knowledge.props, { name: 'disabled', type: 'boolean | undefined', optional: true }],
      }).some((item) => item.kind === 'attribute'),
    ).toBe(false);
  });

  it('React prop과 HTML attribute 이름이 다르면 expected는 DOM 이름을 쓴다', () => {
    expect(
      toRuntimeExpectations({
        ...knowledge,
        nativeAttributes: [{ prop: 'readOnly', attribute: 'readonly' }],
      }),
    ).toContainEqual({
      prop: 'readOnly',
      kind: 'attribute',
      attribute: 'readonly',
      value: true,
    });
  });
});

describe('compareRuntime', () => {
  const expectations = toRuntimeExpectations(knowledge);

  it('renderChanged면 pass다', () => {
    expect(
      compareRuntime(expectations, [
        { prop: 'tone', kind: 'conditional-render', renderChanged: true },
      ]),
    ).toContainEqual({ prop: 'tone', kind: 'conditional-render', status: 'pass' });
  });

  it('화면이 안 바뀌면 fail이다', () => {
    expect(
      compareRuntime(expectations, [
        { prop: 'tone', kind: 'conditional-render', renderChanged: false },
      ]),
    ).toContainEqual({ prop: 'tone', kind: 'conditional-render', status: 'fail' });
  });

  it('attribute expected와 관측값이 같으면 pass다', () => {
    expect(
      compareRuntime(
        [{ kind: 'attribute', prop: 'disabled', attribute: 'disabled', value: true }],
        [{ prop: 'disabled', kind: 'attribute', attributes: { disabled: true } }],
      ),
    ).toEqual([{ prop: 'disabled', kind: 'attribute', status: 'pass' }]);
  });

  it('지정한 attribute가 렌더되지 않으면 fail이다', () => {
    expect(
      compareRuntime(
        [{ kind: 'attribute', prop: 'disabled', attribute: 'disabled', value: true }],
        [{ prop: 'disabled', kind: 'attribute', attributes: { disabled: false } }],
      ),
    ).toEqual([{ prop: 'disabled', kind: 'attribute', status: 'fail' }]);
  });
});
