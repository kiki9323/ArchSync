import { activationValue } from './activate-prop.js';
import { observeSnapshot, type BrowserObserver } from './browser-tool.js';
import type { FixtureSession } from './fixture-session.js';

/**
 * Fixture Harness: 최소 렌더 환경만 준비한다.
 * Knowledge 해석 / pass/fail 판단은 하지 않는다.
 * v0.1은 native boolean attribute처럼 값이 결정적인 prop만 주입한다.
 */
export function createFixtureObserver(session: FixtureSession): BrowserObserver {
  return {
    harness: 'fixture',
    async observe(input) {
      if (!input.attribute) {
        return { status: 'skipped', reason: 'cannot-activate-prop' };
      }

      const activated = activationValue(input.propType);

      if (activated === undefined) {
        return { status: 'skipped', reason: 'cannot-activate-prop' };
      }

      const snapshot = await session.render({
        props: { [input.prop]: activated === 'true' },
      });

      return observeSnapshot({
        snapshot,
        attribute: input.attribute,
      });
    },
  };
}
