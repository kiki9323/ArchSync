import type { ObserveResult } from './observation-result.js';
import { domSnapshotChanged } from './snapshot.js';

export type RuntimeHarnessKind = 'storybook' | 'app' | 'fixture';

export interface DomSnapshot {
  html: string;
  attributes?: Record<string, boolean>;
}

export interface BrowserObserver {
  harness: RuntimeHarnessKind;
  observe(input: {
    component: string;
    prop: string;
    propType: string;
    attribute?: string;
  }): Promise<ObserveResult>;
}

/**
 * Harness가 준비한 DOM snapshot만 본다. Knowledge를 해석하지 않는다.
 * pass/fail은 compareRuntime의 일이다.
 */
export function observeSnapshot(input: {
  snapshot: DomSnapshot | undefined;
  baseline?: DomSnapshot;
  attribute?: string;
}): ObserveResult {
  if (!input.snapshot) {
    return { status: 'skipped', reason: 'snapshot-unavailable' };
  }

  const attributes = input.attribute
    ? { [input.attribute]: Boolean(input.snapshot.attributes?.[input.attribute]) }
    : undefined;

  return {
    status: 'observed',
    renderChanged: input.baseline
      ? domSnapshotChanged(input.baseline.html, input.snapshot.html)
      : false,
    attributes,
  };
}
