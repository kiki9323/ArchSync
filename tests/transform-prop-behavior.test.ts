import { describe, expect, it } from 'vitest';

import { transformPropBehavior } from '../src/knowledge/transform-prop-behavior.js';

describe('transformPropBehavior', () => {
  it('jsx usage를 conditional-render behavior로 변환한다', () => {
    const result = transformPropBehavior([
      {
        kind: 'logical-condition',
        context: 'jsx',
        expression: 'error && <ErrorMessage />',
      },
    ]);

    expect(result).toEqual([
      {
        kind: 'conditional-render',
        evidence: 'error && <ErrorMessage />',
      },
    ]);
  });

  it('expression usage를 conditional-logic behavior로 변환한다', () => {
    const result = transformPropBehavior([
      {
        kind: 'logical-condition',
        context: 'expression',
        expression: 'startIcon && endIcon',
      },
    ]);

    expect(result).toEqual([
      {
        kind: 'conditional-logic',
        evidence: 'startIcon && endIcon',
      },
    ]);
  });

  it('conditional + jsx도 conditional-render로 압축한다', () => {
    const result = transformPropBehavior([
      {
        kind: 'conditional',
        context: 'jsx',
        expression: 'open ? <Panel /> : null',
      },
    ]);

    expect(result).toEqual([
      {
        kind: 'conditional-render',
        evidence: 'open ? <Panel /> : null',
      },
    ]);
  });
});
