export type ObservationSkipReason =
  | 'storybook-unreachable'
  | 'app-unreachable'
  | 'browser-launch-failed'
  | 'no-story'
  | 'target-not-found'
  | 'cannot-activate-prop'
  | 'snapshot-unavailable'
  | 'fixture-unreachable';

export type ObserveResult =
  | { status: 'observed'; renderChanged: boolean; attributes?: Record<string, boolean> }
  | { status: 'skipped'; reason: ObservationSkipReason };

export interface ObservationSkip {
  prop: string;
  reason: ObservationSkipReason;
}
