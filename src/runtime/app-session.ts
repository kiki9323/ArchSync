import type { DomSnapshot } from './browser-tool.js';

export interface AppTarget {
  route: string;
  selector: string;
}

export interface AppSession {
  open(target: AppTarget): Promise<DomSnapshot | undefined>;
}
