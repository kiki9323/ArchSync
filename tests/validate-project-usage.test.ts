import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { validateProjectUsage } from '../src/validator/validate-project-usage.js';

async function makeProject() {
  const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'archsync-validate-'));
  const knowledgeDir = path.join(projectRoot, '.knowledge', 'components');
  const srcDir = path.join(projectRoot, 'src', 'pages');

  await fs.mkdir(knowledgeDir, { recursive: true });
  await fs.mkdir(srcDir, { recursive: true });

  await fs.writeFile(
    path.join(knowledgeDir, 'Chip.json'),
    `${JSON.stringify(
      {
        component: 'Chip',
        nativeProps: [],
        sources: ['chip.tsx'],
        props: [
          {
            name: 'tone',
            type: '"info" | "warn" | undefined',
            optional: true,
            values: ['info', 'warn'],
          },
        ],
      },
      null,
      2,
    )}\n`,
    'utf8',
  );

  return { projectRoot, srcDir };
}

describe('validateProjectUsage', () => {
  it('Knowledge SSOT를 읽어 src 아래 JSX 리터럴을 검사한다', async () => {
    const { projectRoot, srcDir } = await makeProject();

    await fs.writeFile(
      path.join(srcDir, 'page.tsx'),
      `export function Page() { return <Chip tone="rainbow" />; }\n`,
      'utf8',
    );

    const result = await validateProjectUsage({
      projectRoot,
      component: 'Chip',
    });

    expect(result.knowledge).toBe('.knowledge/components/Chip.json');
    expect(result.summary).toEqual({
      filesScanned: 1,
      usages: 1,
      checked: 1,
      violations: 1,
      unknown: 0,
    });
    expect(result.violations).toEqual([
      expect.objectContaining({
        file: 'src/pages/page.tsx',
        component: 'Chip',
        prop: 'tone',
        value: 'rainbow',
        allowed: ['info', 'warn'],
      }),
    ]);
    expect(result.unknown).toEqual([]);
  });

  it('--file이 있으면 그 파일만 검사한다', async () => {
    const { projectRoot, srcDir } = await makeProject();

    await fs.writeFile(
      path.join(srcDir, 'ok.tsx'),
      `export function Ok() { return <Chip tone="info" />; }\n`,
      'utf8',
    );
    await fs.writeFile(
      path.join(srcDir, 'bad.tsx'),
      `export function Bad() { return <Chip tone="rainbow" />; }\n`,
      'utf8',
    );

    const result = await validateProjectUsage({
      projectRoot,
      component: 'Chip',
      file: 'src/pages/ok.tsx',
    });

    expect(result.summary.filesScanned).toBe(1);
    expect(result.violations).toEqual([]);
    expect(result.unknown).toEqual([]);
  });

  it('Knowledge 파일이 없으면 실패한다', async () => {
    const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'archsync-validate-missing-'));

    await expect(
      validateProjectUsage({
        projectRoot,
        component: 'Chip',
      }),
    ).rejects.toThrow('Knowledge not found');
  });
});
