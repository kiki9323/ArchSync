import type { ComponentBehavior } from '../schema/component-knowledge.js';
import type { ComponentRaw } from '../schema/component-raw.js';

export type PropBehavior = ComponentBehavior;

type PropUsage = NonNullable<ComponentRaw['customProps'][number]['usage']>[number];

/**
 * RAW usage → Knowledge behavior.
 *
 * RAW는 syntax를 보존한다: conditional / logical-condition
 * Knowledge는 context로 의미를 압축한다.
 *
 * jsx        → conditional-render
 * expression → conditional-logic
 *
 * prop 이름은 보지 않는다.
 */
export function transformPropBehavior(usage: PropUsage[]): PropBehavior[] {
  return usage.map((item) => {
    if (item.context === 'jsx') {
      return {
        kind: 'conditional-render',
        evidence: item.expression,
      };
    }

    return {
      kind: 'conditional-logic',
      evidence: item.expression,
    };
  });
}
