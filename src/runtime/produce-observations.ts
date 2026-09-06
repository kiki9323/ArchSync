import type { ComponentKnowledge } from '../schema/component-knowledge.js';
import type { RuntimeExpectation, RuntimeObservation } from '../schema/runtime.js';
import type { BrowserObserver } from './browser-tool.js';
import type { ObservationSkip, ObservationSkipReason } from './observation-result.js';

export interface ProducedObservations {
  observations: RuntimeObservation[];
  skipped: ObservationSkip[];
}

/**
 * Browser Tool은 expected에 적힌 것만 관측한다. Knowledge를 해석하지 않는다.
 * pass/fail은 compareRuntime의 일이다.
 */
export async function produceObservations(input: {
  knowledge: ComponentKnowledge;
  expectations: RuntimeExpectation[];
  observer: BrowserObserver;
}): Promise<ProducedObservations> {
  const observations: RuntimeObservation[] = [];
  const skipped: ObservationSkip[] = [];

  for (const expectation of input.expectations) {
    const observed = await input.observer.observe(toObserveInput(input.knowledge, expectation));

    if (observed.status === 'skipped') {
      skipped.push({ prop: expectation.prop, reason: observed.reason });
      continue;
    }

    const observation: RuntimeObservation = {
      prop: expectation.prop,
      kind: expectation.kind,
    };

    if (observed.attributes) {
      observation.attributes = observed.attributes;
    }

    if (expectation.kind === 'conditional-render') {
      observation.renderChanged = observed.renderChanged;
    }

    observations.push(observation);
  }

  return { observations, skipped };
}

function toObserveInput(
  knowledge: ComponentKnowledge,
  expectation: RuntimeExpectation,
): {
  component: string;
  prop: string;
  propType: string;
  attribute?: string;
} {
  if (expectation.kind === 'attribute') {
    return {
      component: knowledge.component,
      prop: expectation.prop,
      propType: 'boolean',
      attribute: expectation.attribute,
    };
  }

  const prop = knowledge.props.find((item) => item.name === expectation.prop);

  return {
    component: knowledge.component,
    prop: expectation.prop,
    propType: prop?.type ?? 'unknown',
    attribute: undefined,
  };
}

export function skipAllExpectations(
  expectations: RuntimeExpectation[],
  reason: ObservationSkipReason,
): ProducedObservations {
  return {
    observations: [],
    skipped: expectations.map((expectation) => ({
      prop: expectation.prop,
      reason,
    })),
  };
}
