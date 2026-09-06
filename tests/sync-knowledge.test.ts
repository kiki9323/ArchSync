import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { getComponentContext } from '../src/context/get-component-context.js';
import { searchComponentContexts } from '../src/context/search-component-contexts.js';
import { extractComponent } from '../src/extractor/component.js';
import { knowledgeArtifactPolicy } from '../src/knowledge/artifact-policy.js';
import { loadSyncComponentRoots } from '../src/sync/load-sync-config.js';
import { syncKnowledge } from '../src/sync/sync-knowledge.js';
import {
  shouldIgnoreWatchPath,
  watchKnowledge,
} from '../src/sync/watch-knowledge.js';

async function temporaryProject(): Promise<string> {
  const projectRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), 'archsync-sync-'),
  );

  await fs.cp(path.resolve('fixtures/sync-project'), projectRoot, {
    recursive: true,
  });

  await fs.rm(path.join(projectRoot, '.knowledge'), { recursive: true, force: true });
  return projectRoot;
}

describe('syncKnowledge', () => {
  it('최초 sync는 Knowledge와 manifest를 생성한다', async () => {
    const projectRoot = await temporaryProject();
    const extractionInputs: string[] = [];
    const result = await syncKnowledge(
      {
        projectRoot,
        componentRoots: ['src/components/ui', 'src/components/shared'],
      },
      {
        extract(input) {
          extractionInputs.push(input.propsInterfaceName ?? input.componentName!);

          if (input.propsInterfaceName === 'BrokenProps') {
            throw new Error('intentional extraction failure');
          }

          return extractComponent(input);
        },
      },
    );

    expect(result.mode).toBe('incremental-sync');
    expect(result.summary).toEqual({
      discovered: 4,
      created: 3,
      updated: 0,
      unchanged: 0,
      deleted: 0,
      skipped: 0,
      failed: 1,
      extracted: 4,
    });
    expect(extractionInputs).toEqual([
      'BrokenProps',
      'CardProps',
      'ButtonProps',
      'ModalProps',
    ]);

    const manifest = JSON.parse(
      await fs.readFile(path.join(projectRoot, '.knowledge/manifest.json'), 'utf8'),
    );

    expect(manifest.version).toBe(1);
    expect(manifest.components.Button).toMatchObject({
      modulePath: 'src/components/ui/button.tsx',
      exportName: 'Button',
      propsInterfaceName: 'ButtonProps',
    });
    expect(manifest.components.Button.fingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(manifest.components.Button.dependencies).toContain(
      'src/components/ui/button.tsx',
    );
  });

  it('변경 없는 두 번째 sync는 extraction 전에 unchanged skip 한다', async () => {
    const projectRoot = await temporaryProject();
    const input = {
      projectRoot,
      componentRoots: ['src/components/ui'],
    };
    const extractionInputs: string[] = [];

    const first = await syncKnowledge(input);
    const knowledgePath = path.join(
      projectRoot,
      '.knowledge/components/Button.json',
    );
    const firstMtime = (await fs.stat(knowledgePath)).mtimeMs;

    const second = await syncKnowledge(input, {
      extract(extractInput) {
        extractionInputs.push(extractInput.propsInterfaceName ?? extractInput.componentName!);
        return extractComponent(extractInput);
      },
    });
    const secondMtime = (await fs.stat(knowledgePath)).mtimeMs;

    expect(first.summary.created).toBe(2);
    expect(second.summary).toMatchObject({
      created: 0,
      updated: 0,
      unchanged: 2,
      deleted: 0,
      extracted: 0,
    });
    expect(extractionInputs).toEqual([]);
    expect(secondMtime).toBe(firstMtime);
    expect(
      second.components.every(
        (component) => component.reason === 'fingerprint-match',
      ),
    ).toBe(true);
  });

  it('component source 변경 시 해당 component만 updated 한다', async () => {
    const projectRoot = await temporaryProject();
    const input = {
      projectRoot,
      componentRoots: ['src/components/ui'],
    };
    const extractionInputs: string[] = [];

    await syncKnowledge(input);

    const buttonPath = path.join(projectRoot, 'src/components/ui/button.tsx');
    const source = await fs.readFile(buttonPath, 'utf8');
    await fs.writeFile(
      buttonPath,
      source.replace("variant = 'filled'", "variant = 'outline'"),
      'utf8',
    );

    const result = await syncKnowledge(input, {
      extract(extractInput) {
        extractionInputs.push(extractInput.propsInterfaceName ?? extractInput.componentName!);
        return extractComponent(extractInput);
      },
    });

    expect(extractionInputs).toEqual(['ButtonProps']);
    expect(result.summary).toMatchObject({
      updated: 1,
      unchanged: 1,
      extracted: 1,
    });

    const knowledge = JSON.parse(
      await fs.readFile(
        path.join(projectRoot, '.knowledge/components/Button.json'),
        'utf8',
      ),
    );
    expect(knowledge.props[0].defaultValue).toBe('outline');
  });

  it('direct local type dependency 변경 시 해당 component를 갱신한다', async () => {
    const projectRoot = await temporaryProject();
    const buttonDir = path.join(projectRoot, 'src/components/ui');

    await fs.writeFile(
      path.join(buttonDir, 'button.types.ts'),
      `export interface CommonButtonProps {
  variant?: 'filled' | 'outline' | 'ghost';
}
`,
      'utf8',
    );
    await fs.writeFile(
      path.join(buttonDir, 'button.tsx'),
      `import type { CommonButtonProps } from './button.types';

export interface ButtonProps extends CommonButtonProps {}

function defineComponent<T>(render: (props: T) => unknown) {
  return render;
}

export const Button = defineComponent<ButtonProps>(
  ({ variant = 'filled' }) => <button data-variant={variant} />,
);
`,
      'utf8',
    );

    const input = {
      projectRoot,
      componentRoots: ['src/components/ui'],
    };

    await syncKnowledge(input);

    const manifest = JSON.parse(
      await fs.readFile(path.join(projectRoot, '.knowledge/manifest.json'), 'utf8'),
    );
    expect(manifest.components.Button.dependencies).toEqual(
      expect.arrayContaining([
        'src/components/ui/button.tsx',
        'src/components/ui/button.types.ts',
      ]),
    );

    const extractionInputs: string[] = [];
    await fs.writeFile(
      path.join(buttonDir, 'button.types.ts'),
      `export interface CommonButtonProps {
  variant?: 'filled' | 'outline' | 'ghost' | 'underline';
}
`,
      'utf8',
    );

    const result = await syncKnowledge(input, {
      extract(extractInput) {
        extractionInputs.push(extractInput.propsInterfaceName ?? extractInput.componentName!);
        return extractComponent(extractInput);
      },
    });

    expect(extractionInputs).toEqual(['ButtonProps']);
    expect(result.summary.extracted).toBe(1);

    const knowledge = JSON.parse(
      await fs.readFile(
        path.join(projectRoot, '.knowledge/components/Button.json'),
        'utf8',
      ),
    );
    expect(knowledge.props[0].values).toEqual([
      'filled',
      'outline',
      'ghost',
      'underline',
    ]);
  });

  it('무관한 파일 변경은 component extraction을 하지 않는다', async () => {
    const projectRoot = await temporaryProject();
    const input = {
      projectRoot,
      componentRoots: ['src/components/ui'],
    };
    const extractionInputs: string[] = [];

    await syncKnowledge(input);
    await fs.writeFile(
      path.join(projectRoot, 'src/components/ui/readme.txt'),
      'unrelated',
      'utf8',
    );

    const result = await syncKnowledge(input, {
      extract(extractInput) {
        extractionInputs.push(extractInput.propsInterfaceName ?? extractInput.componentName!);
        return extractComponent(extractInput);
      },
    });

    expect(extractionInputs).toEqual([]);
    expect(result.summary.extracted).toBe(0);
    expect(result.summary.unchanged).toBe(2);
  });

  it('component 삭제 시 stale Knowledge와 RAW를 제거한다', async () => {
    const projectRoot = await temporaryProject();
    const input = {
      projectRoot,
      componentRoots: ['src/components/ui'],
    };

    await syncKnowledge(input);
    await fs.unlink(path.join(projectRoot, 'src/components/ui/modal.tsx'));

    const result = await syncKnowledge(input);

    expect(result.summary.deleted).toBe(1);
    expect(result.components).toContainEqual(
      expect.objectContaining({
        component: 'Modal',
        status: 'deleted',
      }),
    );
    await expect(
      fs.access(path.join(projectRoot, '.knowledge/components/Modal.json')),
    ).rejects.toThrow();
    await expect(
      fs.access(path.join(projectRoot, '.knowledge/raw/components/Modal.json')),
    ).rejects.toThrow();

    const manifest = JSON.parse(
      await fs.readFile(path.join(projectRoot, '.knowledge/manifest.json'), 'utf8'),
    );
    expect(manifest.components.Modal).toBeUndefined();
    expect(manifest.components.Button).toBeDefined();
  });

  it('한 component 실패 후에도 sync하고 Context Search까지 닫힌 루프로 연결한다', async () => {
    const projectRoot = await temporaryProject();
    const result = await syncKnowledge(
      {
        projectRoot,
        componentRoots: ['src/components/ui', 'src/components/shared'],
      },
      {
        extract(input) {
          if (input.propsInterfaceName === 'BrokenProps') {
            throw new Error('broken component');
          }

          return extractComponent(input);
        },
      },
    );

    expect(result.summary.failed).toBe(1);
    expect(result.summary.created).toBe(3);

    const search = await searchComponentContexts(projectRoot, 'button');

    expect(search).toMatchObject({
      status: 'matches',
      matches: [
        {
          component: 'Button',
          reasons: expect.arrayContaining([
            {
              kind: 'component-name-case-insensitive',
              matched: 'button',
            },
          ]),
        },
      ],
    });
  });
});

describe('loadSyncComponentRoots', () => {
  it('project config 또는 CLI roots를 사용한다', async () => {
    const projectRoot = await temporaryProject();

    await fs.writeFile(
      path.join(projectRoot, 'archsync.config.json'),
      JSON.stringify({ componentRoots: ['src/components/ui'] }),
      'utf8',
    );

    await expect(loadSyncComponentRoots({ projectRoot })).resolves.toEqual([
      'src/components/ui',
    ]);
    await expect(
      loadSyncComponentRoots({
        projectRoot,
        cliRoots: ['src/components/shared'],
      }),
    ).resolves.toEqual(['src/components/shared']);
  });
});

describe('syncKnowledge aliases', () => {
  it('config alias 변경이 Knowledge search metadata와 Search에 반영된다', async () => {
    const projectRoot = await temporaryProject();

    await fs.writeFile(
      path.join(projectRoot, 'archsync.config.json'),
      JSON.stringify({
        componentRoots: ['src/components/ui'],
        componentAliases: {
          Button: ['버튼', 'cta'],
        },
      }),
      'utf8',
    );

    const first = await syncKnowledge({
      projectRoot,
      componentRoots: ['src/components/ui'],
    });

    expect(first.summary.created).toBe(2);

    const buttonKnowledge = JSON.parse(
      await fs.readFile(
        path.join(projectRoot, '.knowledge/components/Button.json'),
        'utf8',
      ),
    );

    expect(buttonKnowledge.search).toEqual({
      aliases: [
        { value: 'cta', source: 'config' },
        { value: '버튼', source: 'config' },
      ],
    });

    await fs.writeFile(
      path.join(projectRoot, 'archsync.config.json'),
      JSON.stringify({
        componentRoots: ['src/components/ui'],
        componentAliases: {
          Button: ['액션'],
        },
      }),
      'utf8',
    );

    const second = await syncKnowledge({
      projectRoot,
      componentRoots: ['src/components/ui'],
    });

    expect(second.summary.updated).toBeGreaterThanOrEqual(1);
    expect(second.summary.extracted).toBeGreaterThanOrEqual(1);

    const updated = JSON.parse(
      await fs.readFile(
        path.join(projectRoot, '.knowledge/components/Button.json'),
        'utf8',
      ),
    );

    expect(updated.search).toEqual({
      aliases: [{ value: '액션', source: 'config' }],
    });
  });
});

describe('watchKnowledge', () => {
  it('.knowledge 변경은 self-trigger 대상에서 제외한다', () => {
    const projectRoot = '/tmp/project';

    expect(
      shouldIgnoreWatchPath(projectRoot, '/tmp/project/.knowledge/components/Button.json'),
    ).toBe(true);
    expect(
      shouldIgnoreWatchPath(projectRoot, '/tmp/project/.knowledge/manifest.json'),
    ).toBe(true);
    expect(
      shouldIgnoreWatchPath(projectRoot, '/tmp/project/src/components/ui/button.tsx'),
    ).toBe(false);
    expect(
      shouldIgnoreWatchPath(projectRoot, '/tmp/project/src/components/ui/button.stories.tsx'),
    ).toBe(true);
  });

  it('여러 fs event를 debounce하고 sync 실패 후에도 계속 동작한다', async () => {
    const projectRoot = await temporaryProject();
    const syncResults: number[] = [];
    const errors: unknown[] = [];
    let syncCalls = 0;
    const listeners: Array<
      (eventType: string, filename: string | Buffer | null) => void
    > = [];

    const handle = await watchKnowledge(
      {
        projectRoot,
        componentRoots: ['src/components/ui'],
        debounceMs: 40,
      },
      {
        onSync(result) {
          syncResults.push(result.summary.extracted);
        },
        onError(error) {
          errors.push(error);
        },
      },
      {
        async sync(input) {
          syncCalls += 1;

          if (syncCalls === 2) {
            throw new Error('transient extraction failure');
          }

          return syncKnowledge(input);
        },
        watch(_target, _options, listener) {
          listeners.push(listener);

          return {
            close(callback) {
              callback?.();
            },
            on() {},
          };
        },
      },
    );

    expect(syncResults).toHaveLength(1);
    expect(listeners.length).toBeGreaterThan(0);

    const emit = listeners[0];
    emit('change', 'button.tsx');
    emit('change', 'button.tsx');
    emit('change', 'button.tsx');

    await waitFor(() => errors.length >= 1, 1000);
    expect(syncCalls).toBe(2);

    emit('change', 'button.tsx');
    await waitFor(() => syncResults.length >= 2, 1000);
    expect(syncResults.length).toBe(2);

    emit('change', path.join(projectRoot, '.knowledge/components/Button.json'));
    await sleep(80);
    expect(syncResults.length).toBe(2);

    await handle.close();
  });

  it('code change 후 Context가 최신 Knowledge를 반환하고 원복도 반영한다', async () => {
    const projectRoot = await temporaryProject();
    const buttonDir = path.join(projectRoot, 'src/components/ui');

    await fs.writeFile(
      path.join(buttonDir, 'button.types.ts'),
      `export interface CommonButtonProps {
  variant?: 'filled' | 'outline';
}
`,
      'utf8',
    );
    await fs.writeFile(
      path.join(buttonDir, 'button.tsx'),
      `import type { CommonButtonProps } from './button.types';

export interface ButtonProps extends CommonButtonProps {}

function defineComponent<T>(render: (props: T) => unknown) {
  return render;
}

export const Button = defineComponent<ButtonProps>(
  ({ variant = 'filled' }) => <button data-variant={variant} />,
);
`,
      'utf8',
    );

    await syncKnowledge({
      projectRoot,
      componentRoots: ['src/components/ui'],
    });

    const before = await getComponentContext(projectRoot, 'Button');
    expect(before.status).toBe('ready');
    if (before.status !== 'ready') {
      throw new Error('expected ready context');
    }
    expect(before.props.find((prop) => prop.name === 'variant')?.values).toEqual([
      'filled',
      'outline',
    ]);

    await fs.writeFile(
      path.join(buttonDir, 'button.types.ts'),
      `export interface CommonButtonProps {
  variant?: 'filled' | 'outline' | 'ghost';
}
`,
      'utf8',
    );

    const updatedSync = await syncKnowledge({
      projectRoot,
      componentRoots: ['src/components/ui'],
    });
    expect(updatedSync.summary).toMatchObject({
      updated: 1,
      extracted: 1,
    });

    const updated = await getComponentContext(projectRoot, 'Button');
    expect(updated.status).toBe('ready');
    if (updated.status !== 'ready') {
      throw new Error('expected ready context');
    }
    expect(updated.props.find((prop) => prop.name === 'variant')?.values).toEqual([
      'filled',
      'outline',
      'ghost',
    ]);

    await fs.writeFile(
      path.join(buttonDir, 'button.types.ts'),
      `export interface CommonButtonProps {
  variant?: 'filled' | 'outline';
}
`,
      'utf8',
    );

    const restoredSync = await syncKnowledge({
      projectRoot,
      componentRoots: ['src/components/ui'],
    });
    expect(restoredSync.summary.extracted).toBe(1);

    const restored = await getComponentContext(projectRoot, 'Button');
    expect(restored.status).toBe('ready');
    if (restored.status !== 'ready') {
      throw new Error('expected ready context');
    }
    expect(restored.props.find((prop) => prop.name === 'variant')?.values).toEqual([
      'filled',
      'outline',
    ]);
  });
});

describe('artifact policy', () => {
  it('manifest를 generated metadata로 분류한다', () => {
    expect(knowledgeArtifactPolicy.syncManifest).toBe('generated-metadata');
  });
});

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(
  predicate: () => boolean,
  timeoutMs: number,
): Promise<void> {
  const started = Date.now();

  while (!predicate()) {
    if (Date.now() - started > timeoutMs) {
      throw new Error('timed out waiting for condition');
    }

    await sleep(20);
  }
}
