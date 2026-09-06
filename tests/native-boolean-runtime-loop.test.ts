import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { extractComponent } from '../src/extractor/component.js';
import { createComponentKnowledge } from '../src/knowledge/create-component-knowledge.js';
import { toRuntimeExpectations } from '../src/validator/to-runtime-expectations.js';

describe('native boolean Source → Knowledge → Expected', () => {
  it('Button disabled는 custom prop이 아니라 attribute expected가 된다', () => {
    const raw = extractComponent({
      projectRoot: path.resolve('fixtures/native-boolean-attrs'),
      file: 'fields.tsx',
      propsInterfaceName: 'ButtonProps',
    });
    const knowledge = createComponentKnowledge(raw);
    const expectations = toRuntimeExpectations(knowledge);

    expect(knowledge.props.map((prop) => prop.name)).toEqual(['isLoading', 'fullWidth']);
    expect(knowledge.nativeAttributes).toEqual(
      expect.arrayContaining([{ prop: 'disabled', attribute: 'disabled' }]),
    );
    expect(expectations).toContainEqual({
      prop: 'disabled',
      kind: 'attribute',
      attribute: 'disabled',
      value: true,
    });
    expect(expectations.some((item) => item.prop === 'isLoading' && item.kind === 'attribute')).toBe(
      false,
    );
    expect(expectations.some((item) => item.prop === 'fullWidth')).toBe(false);
  });

  it('Input readOnly는 HTML attribute 이름 readonly로 expected를 만든다', () => {
    const raw = extractComponent({
      projectRoot: path.resolve('fixtures/native-boolean-attrs'),
      file: 'fields.tsx',
      propsInterfaceName: 'InputProps',
    });
    const knowledge = createComponentKnowledge(raw);
    const expectations = toRuntimeExpectations(knowledge);

    expect(knowledge.nativeAttributes).toEqual(
      expect.arrayContaining([{ prop: 'readOnly', attribute: 'readonly' }]),
    );
    expect(expectations).toContainEqual({
      prop: 'readOnly',
      kind: 'attribute',
      attribute: 'readonly',
      value: true,
    });
  });

  it('deeps-www Button은 native disabled와 custom isLoading을 구분한다', () => {
    const raw = extractComponent({
      projectRoot: path.resolve('../deeps-www'),
      file: 'src/components/ui/button/button.tsx',
      propsInterfaceName: 'ButtonProps',
    });
    const knowledge = createComponentKnowledge(raw);
    const expectations = toRuntimeExpectations(knowledge);

    expect(raw.customProps.some((prop) => prop.name === 'disabled')).toBe(false);
    expect(knowledge.props.some((prop) => prop.name === 'disabled')).toBe(false);
    expect(knowledge.nativeAttributes).toEqual([{ prop: 'disabled', attribute: 'disabled' }]);
    expect(expectations).toContainEqual({
      prop: 'disabled',
      kind: 'attribute',
      attribute: 'disabled',
      value: true,
    });
    expect(expectations.some((item) => item.prop === 'isLoading' && item.kind === 'attribute')).toBe(
      false,
    );
    expect(expectations).toContainEqual(
      expect.objectContaining({ prop: 'isLoading', kind: 'conditional-render' }),
    );
  });
});
