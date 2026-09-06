import fs from 'node:fs';
import path from 'node:path';

import type { KnowledgeSyncResult } from '../schema/knowledge-sync.js';
import { loadSyncComponentRoots, loadSyncConfig } from './load-sync-config.js';
import { syncKnowledge, type SyncKnowledgeInput } from './sync-knowledge.js';

export interface WatchKnowledgeInput {
  projectRoot: string;
  componentRoots?: string[];
  debounceMs?: number;
}

export interface WatchKnowledgeHandlers {
  onSync?: (result: KnowledgeSyncResult) => void;
  onError?: (error: unknown) => void;
  onFatal?: (error: unknown) => void;
}

export interface WatchSubscription {
  close: (callback?: () => void) => void;
  on: (event: 'error', listener: (error: Error) => void) => void;
}

export interface WatchKnowledgeDependencies {
  sync?: typeof syncKnowledge;
  watch?: (
    target: string,
    options: { recursive: boolean },
    listener: (eventType: string, filename: string | Buffer | null) => void,
  ) => WatchSubscription;
}

export interface WatchKnowledgeHandle {
  close: () => Promise<void>;
}

const DEFAULT_DEBOUNCE_MS = 200;

/**
 * Incremental sync API를 호출하는 thin watch layer.
 * extraction/knowledge logic은 여기서 다시 구현하지 않는다.
 */
export async function watchKnowledge(
  input: WatchKnowledgeInput,
  handlers: WatchKnowledgeHandlers = {},
  dependencies: WatchKnowledgeDependencies = {},
): Promise<WatchKnowledgeHandle> {
  const projectRoot = path.resolve(input.projectRoot);
  const debounceMs = input.debounceMs ?? DEFAULT_DEBOUNCE_MS;
  const sync = dependencies.sync ?? syncKnowledge;
  const watch = dependencies.watch ?? defaultWatch;
  const componentRoots =
    input.componentRoots ??
    (await loadSyncComponentRoots({ projectRoot }));
  const watchTargets = await resolveWatchTargets(projectRoot, componentRoots);
  const watchers: WatchSubscription[] = [];
  let timer: NodeJS.Timeout | undefined;
  let closed = false;
  let running: Promise<void> | undefined;
  let pending = false;

  const runSync = async () => {
    if (closed) {
      return;
    }

    if (running) {
      pending = true;
      return;
    }

    running = (async () => {
      try {
        const syncInput: SyncKnowledgeInput = {
          projectRoot,
          componentRoots,
        };
        const result = await sync(syncInput);
        handlers.onSync?.(result);
      } catch (error) {
        if (isFatalWatchError(error)) {
          handlers.onFatal?.(error);
          await close();
          return;
        }

        handlers.onError?.(error);
      } finally {
        running = undefined;

        if (pending && !closed) {
          pending = false;
          schedule();
        }
      }
    })();

    await running;
  };

  const schedule = () => {
    if (closed) {
      return;
    }

    if (timer) {
      clearTimeout(timer);
    }

    timer = setTimeout(() => {
      void runSync();
    }, debounceMs);
    timer.unref?.();
  };

  // 초기 sync를 watcher보다 먼저 실행해 .knowledge 기록이 self-trigger 되지 않게 한다.
  await runSync();

  const onFsEvent = (eventPath?: string) => {
    if (closed) {
      return;
    }

    if (eventPath && shouldIgnoreWatchPath(projectRoot, eventPath)) {
      return;
    }

    schedule();
  };

  for (const target of watchTargets) {
    try {
      const watcher = watch(
        target,
        { recursive: isDirectorySync(target) },
        (_eventType, filename) => {
          onFsEvent(
            filename ? path.join(target, filename.toString()) : target,
          );
        },
      );
      watcher.on('error', (error) => {
        handlers.onError?.(error);
      });
      watchers.push(watcher);
    } catch (error) {
      handlers.onFatal?.(error);
      throw error;
    }
  }

  async function close() {
    if (closed) {
      return;
    }

    closed = true;

    if (timer) {
      clearTimeout(timer);
    }

    await Promise.all(
      watchers.map(
        (watcher) =>
          new Promise<void>((resolve) => {
            watcher.close(() => resolve());
          }),
      ),
    );
  }

  return { close };
}

function defaultWatch(
  target: string,
  options: { recursive: boolean },
  listener: (eventType: string, filename: string | Buffer | null) => void,
): WatchSubscription {
  return fs.watch(target, options, listener);
}

function isDirectorySync(target: string): boolean {
  try {
    return fs.statSync(target).isDirectory();
  } catch {
    return false;
  }
}

async function resolveWatchTargets(
  projectRoot: string,
  componentRoots: string[],
): Promise<string[]> {
  const targets = new Set<string>();

  for (const root of componentRoots) {
    const absolute = path.join(projectRoot, root);

    try {
      await fs.promises.access(absolute);
      targets.add(absolute);
    } catch {
      targets.add(projectRoot);
    }
  }

  const configPath = path.join(projectRoot, 'archsync.config.json');

  try {
    await fs.promises.access(configPath);
    targets.add(configPath);
  } catch {
    // config가 없어도 component root 감시로 충분하다.
  }

  return [...targets];
}

export function shouldIgnoreWatchPath(
  projectRoot: string,
  eventPath: string,
): boolean {
  const absolute = path.resolve(eventPath);
  const relative = path
    .relative(projectRoot, absolute)
    .split(path.sep)
    .join('/');

  if (relative === '' || relative === '.') {
    return false;
  }

  if (relative.startsWith('..')) {
    return true;
  }

  if (
    relative === '.knowledge' ||
    relative.startsWith('.knowledge/') ||
    relative.includes('/.knowledge/')
  ) {
    return true;
  }

  if (
    relative === 'node_modules' ||
    relative.startsWith('node_modules/') ||
    relative.includes('/node_modules/')
  ) {
    return true;
  }

  if (
    /^(dist|build|coverage)(\/|$)/.test(relative) ||
    relative.includes('/dist/') ||
    relative.includes('/build/')
  ) {
    return true;
  }

  if (/\.(stories|test|spec)\.[^/]+$/.test(relative)) {
    return true;
  }

  if (/\.css\.tsx?$/.test(relative)) {
    return true;
  }

  return false;
}

function isFatalWatchError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return (
    error.name === 'ZodError' ||
    /archsync\.config\.json/i.test(error.message) ||
    /tsconfig/i.test(error.message)
  );
}

export async function loadWatchComponentRoots(projectRoot: string) {
  return loadSyncComponentRoots({ projectRoot });
}

export async function loadWatchConfig(projectRoot: string) {
  return loadSyncConfig({ projectRoot });
}
