import type { ComponentKnowledge } from '../schema/component-knowledge.js';
import type { RuntimeExpectation } from '../schema/runtime.js';

/**
 * Knowledge → 브라우저 expected.
 *
 * - conditional-render: custom prop usage
 * - attribute: native boolean HTML attributes only
 * custom boolean(isLoading, fullWidth)은 attribute expected가 아니다.
 */
export function toRuntimeExpectations(knowledge: ComponentKnowledge): RuntimeExpectation[] {
  const expectations: RuntimeExpectation[] = [];

  for (const prop of knowledge.props) {
    for (const behavior of prop.behavior ?? []) {
      if (behavior.kind !== 'conditional-render') {
        continue;
      }

      expectations.push({
        prop: prop.name,
        kind: 'conditional-render',
        evidence: behavior.evidence,
      });
    }
  }

  for (const nativeAttribute of knowledge.nativeAttributes ?? []) {
    expectations.push({
      prop: nativeAttribute.prop,
      kind: 'attribute',
      attribute: nativeAttribute.attribute,
      value: true,
    });
  }

  return expectations;
}
