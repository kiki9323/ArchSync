import type { AppSession, AppTarget } from './app-session.js';
import { observeSnapshot, type BrowserObserver, type DomSnapshot } from './browser-tool.js';

/**
 * App Harness: 앱을 열고 DOM root만 준비한다.
 * Knowledge 해석 / pass/fail 판단 / prop 활성화는 하지 않는다.
 * v0.1은 이미 렌더된 attribute만 관측한다.
 */
export function createAppObserver(session: AppSession, target: AppTarget): BrowserObserver {
  let snapshotPromise: Promise<DomSnapshot | undefined> | undefined;

  return {
    harness: 'app',
    async observe(input) {
      if (!input.attribute) {
        return { status: 'skipped', reason: 'cannot-activate-prop' };
      }

      snapshotPromise ??= session.open(target);
      const snapshot = await snapshotPromise;

      if (!snapshot) {
        return { status: 'skipped', reason: 'target-not-found' };
      }

      return observeSnapshot({ snapshot, attribute: input.attribute });
    },
  };
}
