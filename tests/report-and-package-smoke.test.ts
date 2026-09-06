import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';

import { describe, expect, it } from 'vitest';

import {
  renderSyncReport,
  renderValidationReport,
} from '../src/report/render-archsync-report.js';
import type { ComponentValidationResult } from '../src/schema/component-validation.js';
import type { KnowledgeSyncResult } from '../src/schema/knowledge-sync.js';

const execFileAsync = promisify(execFile);
const packageRoot = path.resolve('.');

describe('renderArchSyncReport', () => {
  it('static validation report를 text/markdown으로 렌더한다', () => {
    const result: ComponentValidationResult = {
      status: 'failed',
      mode: 'static',
      component: 'Button',
      knowledge: '.knowledge/components/Button.json',
      summary: {
        filesScanned: 2,
        usages: 2,
        checked: 2,
        passed: 1,
        failed: 1,
        unknown: 0,
      },
      violations: [
        {
          file: 'src/app.tsx',
          line: 12,
          component: 'Button',
          prop: 'variant',
          value: '"primary"',
          allowed: ['filled', 'outline'],
        },
      ],
      unknown: [],
    };

    const text = renderValidationReport(result, 'text');
    const markdown = renderValidationReport(result, 'markdown');

    expect(text).toContain('ArchSync Check');
    expect(text).toContain('files checked: 2');
    expect(text).toContain('received: "primary"');
    expect(text).toContain('allowed: filled | outline');
    expect(text).toContain('provenance.knowledge: .knowledge/components/Button.json');

    expect(markdown).toContain('# ArchSync Check');
    expect(markdown).toContain('| failed | 1 |');
    expect(markdown).toContain('## Violations');
  });

  it('missing/runtime 결과도 재판단 없이 표현한다', () => {
    const missing = renderValidationReport(
      {
        status: 'missing',
        mode: 'static',
        component: 'Button',
        reason: 'knowledge-not-found',
        provenance: { knowledge: '.knowledge/components/Button.json' },
      },
      'text',
    );
    const runtime = renderValidationReport(
      {
        status: 'passed',
        mode: 'runtime',
        harness: 'fixture',
        component: 'Button',
        knowledge: '.knowledge/components/Button.json',
        summary: { checked: 1, passed: 1, failed: 0, unknown: 0 },
        comparisons: [
          { prop: 'disabled', kind: 'attribute', status: 'pass' },
        ],
        skipped: [{ prop: 'isLoading', reason: 'no observation' }],
      },
      'markdown',
    );

    expect(missing).toContain('status: missing');
    expect(missing).toContain('Knowledge JSON이 없어 검사하지 못했습니다.');
    expect(runtime).toContain('| harness | fixture |');
    expect(runtime).toContain('## Skipped');
  });

  it('sync report를 렌더한다', () => {
    const result: KnowledgeSyncResult = {
      status: 'ready',
      mode: 'incremental-sync',
      project: '/tmp/app',
      componentRoots: ['src/components/ui'],
      summary: {
        discovered: 2,
        created: 1,
        updated: 0,
        unchanged: 1,
        deleted: 0,
        skipped: 0,
        failed: 0,
        extracted: 1,
      },
      components: [],
    };

    expect(renderSyncReport(result, 'text')).toContain('extracted: 1');
    expect(renderSyncReport(result, 'markdown')).toContain('| extracted | 1 |');
  });
});

describe('package smoke', () => {
  it(
    'npm pack tarball을 clean fixture에 설치해 CLI 흐름을 검증한다',
    async () => {
      await execFileAsync('pnpm', ['build'], { cwd: packageRoot });

      const pack = await execFileAsync('pnpm', ['pack', '--json'], {
        cwd: packageRoot,
      });
      const packed = JSON.parse(pack.stdout) as Array<{ filename: string }> | {
        filename: string;
      };
      const tarballName = Array.isArray(packed)
        ? packed[0]?.filename
        : packed.filename;

      expect(tarballName).toMatch(/^archsync-fe-0\.1\.0\.tgz$/);
      const tarballPath = path.join(packageRoot, tarballName);

      const listing = await execFileAsync('tar', ['-tzf', tarballPath]);
      const files = listing.stdout.split('\n').filter(Boolean);

      expect(files.some((file) => file.includes('bin/archsync.js'))).toBe(true);
      expect(files.some((file) => file.includes('dist/cli.js'))).toBe(true);
      expect(files.some((file) => file.includes('dist/cli.d.ts'))).toBe(true);
      expect(files.some((file) => file.includes('README.md'))).toBe(true);
      expect(files.some((file) => file.includes('package.json'))).toBe(true);
      expect(files.every((file) => !file.includes('tests/'))).toBe(true);
      expect(files.every((file) => !file.includes('fixtures/'))).toBe(true);
      expect(files.every((file) => !file.includes('.knowledge/'))).toBe(true);
      expect(files.every((file) => !file.includes('/Users/'))).toBe(true);

      const consumerRoot = await fs.mkdtemp(
        path.join(os.tmpdir(), 'archsync-consumer-'),
      );

      try {
        await fs.cp(path.resolve('fixtures/sync-project'), consumerRoot, {
          recursive: true,
        });
        await fs.writeFile(
          path.join(consumerRoot, 'package.json'),
          JSON.stringify(
            {
              name: 'archsync-consumer',
              private: true,
              type: 'module',
            },
            null,
            2,
          ),
          'utf8',
        );

        await execFileAsync('pnpm', ['add', tarballPath], {
          cwd: consumerRoot,
        });

        const help = await execFileAsync(
          'pnpm',
          ['exec', 'archsync', '--help'],
          { cwd: consumerRoot },
        );
        expect(help.stdout).toContain('archsync <command>');

        const sync = await execFileAsync(
          'pnpm',
          ['exec', 'archsync', 'sync', '--project', '.', '--format', 'text'],
          { cwd: consumerRoot },
        );
        expect(sync.stdout).toContain('ArchSync Sync');
        expect(sync.stdout).toContain('created:');

        await expect(
          fs.access(path.join(consumerRoot, '.knowledge/components/Button.json')),
        ).resolves.toBeUndefined();

        const search = await execFileAsync(
          'pnpm',
          ['exec', 'archsync', 'search', 'button', '--project', '.'],
          { cwd: consumerRoot },
        );
        expect(search.stdout).toContain('"component": "Button"');

        const context = await execFileAsync(
          'pnpm',
          ['exec', 'archsync', 'context', 'Button', '--project', '.'],
          { cwd: consumerRoot },
        );
        expect(context.stdout).toContain('"status": "ready"');

        const check = await execFileAsync(
          'pnpm',
          [
            'exec',
            'archsync',
            'check',
            'Button',
            '--project',
            '.',
            '--format',
            'markdown',
          ],
          { cwd: consumerRoot },
        );
        expect(check.stdout).toContain('# ArchSync Check');
        expect(check.stdout).toContain('| status |');

        const mcp = spawn('pnpm', ['exec', 'archsync', 'mcp'], {
          cwd: consumerRoot,
          stdio: ['pipe', 'ignore', 'ignore'],
        });
        await sleep(800);
        expect(mcp.exitCode).toBeNull();
        mcp.kill('SIGTERM');
        await new Promise<void>((resolve) => {
          mcp.once('close', () => resolve());
          setTimeout(resolve, 1000);
        });
      } finally {
        await fs.rm(consumerRoot, { recursive: true, force: true });
        await fs.rm(tarballPath, { force: true });
      }
    },
    120_000,
  );
});

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
