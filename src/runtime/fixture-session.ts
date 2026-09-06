import type { DomSnapshot } from './browser-tool.js';

export interface FixtureTarget {
  modulePath: string;
  exportName: string;
}

export interface FixtureSession {
  render(input: { props: Record<string, unknown> }): Promise<DomSnapshot | undefined>;
}
