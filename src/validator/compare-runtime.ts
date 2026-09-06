import type { RuntimeExpectation, RuntimeObservation } from '../schema/runtime.js';

export interface RuntimeComparison {
  prop: string;
  kind: RuntimeExpectation['kind'];
  status: 'pass' | 'fail' | 'missing';
}

export function compareRuntime(
  expectations: RuntimeExpectation[],
  observations: RuntimeObservation[],
): RuntimeComparison[] {
  return expectations.map((expectation) => {
    const observation = observations.find(
      (item) => item.prop === expectation.prop && item.kind === expectation.kind,
    );

    if (!observation) {
      return {
        prop: expectation.prop,
        kind: expectation.kind,
        status: 'missing',
      };
    }

    if (expectation.kind === 'conditional-render') {
      return {
        prop: expectation.prop,
        kind: expectation.kind,
        status: observation.renderChanged ? 'pass' : 'fail',
      };
    }

    const actual = observation.attributes?.[expectation.attribute];

    return {
      prop: expectation.prop,
      kind: expectation.kind,
      status: actual === expectation.value ? 'pass' : 'fail',
    };
  });
}
